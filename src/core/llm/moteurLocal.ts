import type { Llama, LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import { FournisseurStructure } from './fournisseurStructure'
import type { MoteurLLM, RequeteObjet } from './moteur'

type SchemaGrammaire = Parameters<Llama['createGrammarForJsonSchema']>[0]

type Json = Record<string, unknown>

// Convertit un schéma Zod en JSON Schema accepté par la grammaire de node-llama-cpp :
// retire `$schema` et `default`, et rend nullables les propriétés optionnelles, car la grammaire
// impose toutes les clés (sans `null` possible, le modèle serait forcé d'inventer une valeur).
export function versSchemaGrammaire(schema: z.ZodType): SchemaGrammaire {
  const nettoyer = (valeur: unknown): unknown => {
    if (Array.isArray(valeur)) return valeur.map(nettoyer)
    if (valeur === null || typeof valeur !== 'object') return valeur
    const objet = Object.fromEntries(
      Object.entries(valeur)
        .filter(([cle]) => cle !== '$schema' && cle !== 'default')
        .map(([cle, sousValeur]) => [cle, nettoyer(sousValeur)]),
    ) as Json
    if (objet.properties && typeof objet.properties === 'object') {
      const requis = new Set(Array.isArray(objet.required) ? objet.required : [])
      const proprietes = Object.entries(objet.properties as Json).map(([cle, propriete]) => [
        cle,
        requis.has(cle) ? propriete : { oneOf: [propriete, { type: 'null' }] },
      ])
      objet.properties = Object.fromEntries(proprietes)
      delete objet.required
    }
    return objet
  }
  return nettoyer(z.toJSONSchema(schema)) as SchemaGrammaire
}

// Recolle tout le texte généré. Les modèles « à réflexion » (Qwen3.5…) ouvrent le tour par <think> : ce que la
// grammaire force à produire est alors rangé dans un segment de pensée et `responseText` est vide
// (« Unexpected end of JSON input »). Avec une grammaire, tout le texte généré EST la réponse.
export function texteReponse(parties: readonly unknown[]): string {
  return parties
    .map((partie) => {
      if (typeof partie === 'string') return partie
      const texte = (partie as { text?: unknown } | null)?.text
      return typeof texte === 'string' ? texte : ''
    })
    .join('')
}

// Retire les `null` produits pour les champs optionnels avant la validation Zod.
export function retirerNulls(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(retirerNulls)
  if (valeur === null || typeof valeur !== 'object') return valeur
  return Object.fromEntries(
    Object.entries(valeur)
      .filter(([, sousValeur]) => sousValeur !== null)
      .map(([cle, sousValeur]) => [cle, retirerNulls(sousValeur)]),
  )
}

// Contexte (prompt + réponse) : un CV ou une offre font 1 000 à 4 000 jetons, la réponse JSON autant.
// Sans consigne, node-llama-cpp dimensionne le contexte sur la VRAM restante, parfois à quelques centaines
// de jetons : la génération s'arrête alors en plein JSON (« Unexpected end of JSON input »).
const CONTEXTE_CIBLE = 8192
const CONTEXTE_MIN = 4096

const MESSAGE_MEMOIRE =
  'Mémoire insuffisante pour le modèle embarqué. Ferme les applications qui utilisent la carte graphique ' +
  '(Ollama, jeux, autre fenêtre de Re:CV…) ou télécharge un modèle plus petit dans les paramètres.'

// Modèle embarqué (.gguf) : la sortie est contrainte par une grammaire dérivée du schéma Zod.
// Fichier volontairement non exporté par `llm/index.ts` : node-llama-cpp est natif, réservé au process Node.
export class MoteurLocal implements MoteurLLM {
  private chargement?: Promise<{ llama: Llama; modele: LlamaModel }>
  private surCpu = false

  constructor(private readonly cheminModele: string) {}

  private charger(surCpu = this.surCpu) {
    this.chargement ??= (async () => {
      // Import dynamique : node-llama-cpp est ESM avec top-level await (incompatible avec require).
      const { getLlama } = await import('node-llama-cpp')
      const llama = await getLlama()
      // GPU : autant de couches que possible TOUT EN laissant la place d'un contexte de CONTEXTE_CIBLE jetons.
      const modele = await llama.loadModel({
        modelPath: this.cheminModele,
        gpuLayers: surCpu ? 0 : { fitContext: { contextSize: CONTEXTE_CIBLE } },
      })
      return { llama, modele }
    })()
    return this.chargement
  }

  // Si le contexte ne tient pas en VRAM (autre application, Ollama…), on recharge le modèle sur le processeur :
  // plus lent, mais le résultat est correct.
  private async creerContexte() {
    const options = { contextSize: { min: CONTEXTE_MIN, max: CONTEXTE_CIBLE } }
    try {
      const { modele } = await this.charger()
      return await modele.createContext(options)
    } catch (erreur) {
      if (this.surCpu) throw new Error(MESSAGE_MEMOIRE, { cause: erreur })
      await this.liberer()
      this.surCpu = true
      try {
        const { modele } = await this.charger(true)
        return await modele.createContext(options)
      } catch (erreurCpu) {
        throw new Error(MESSAGE_MEMOIRE, { cause: erreurCpu })
      }
    }
  }

  async genererObjet<T>({ schema, systeme, utilisateur, temperature }: RequeteObjet<T>): Promise<T> {
    const contexte = await this.creerContexte()
    const { llama } = await this.charger()
    const grammaire = await llama.createGrammarForJsonSchema(versSchemaGrammaire(schema))
    const { LlamaChatSession } = await import('node-llama-cpp')
    try {
      const session = new LlamaChatSession({ contextSequence: contexte.getSequence(), systemPrompt: systeme })
      const meta = await session.promptWithMeta(utilisateur, { grammar: grammaire, temperature: temperature ?? 0.2 })
      const reponse = texteReponse(meta.response)
      let objet: unknown
      try {
        objet = grammaire.parse(reponse)
      } catch (erreur) {
        throw new Error(
          'Réponse du modèle incomplète (texte trop long pour le contexte, ou mémoire insuffisante). ' +
            'Raccourcis le texte ou choisis un autre modèle.',
          { cause: erreur },
        )
      }
      return schema.parse(retirerNulls(objet))
    } finally {
      await contexte.dispose()
    }
  }

  async liberer(): Promise<void> {
    if (!this.chargement) return
    const { modele } = await this.chargement
    await modele.dispose()
    this.chargement = undefined
  }
}

export function creerFournisseurLocal({ cheminModele }: { cheminModele: string }): FournisseurStructure {
  return new FournisseurStructure(new MoteurLocal(cheminModele))
}
