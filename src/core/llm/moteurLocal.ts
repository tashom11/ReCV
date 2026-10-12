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

// Modèle embarqué (.gguf) : la sortie est contrainte par une grammaire dérivée du schéma Zod.
// Fichier volontairement non exporté par `llm/index.ts` : node-llama-cpp est natif, réservé au process Node.
export class MoteurLocal implements MoteurLLM {
  private chargement?: Promise<{ llama: Llama; modele: LlamaModel }>

  constructor(private readonly cheminModele: string) {}

  private charger() {
    this.chargement ??= (async () => {
      // Import dynamique : node-llama-cpp est ESM avec top-level await (incompatible avec require).
      const { getLlama } = await import('node-llama-cpp')
      const llama = await getLlama()
      const modele = await llama.loadModel({ modelPath: this.cheminModele })
      return { llama, modele }
    })()
    return this.chargement
  }

  async genererObjet<T>({ schema, systeme, utilisateur }: RequeteObjet<T>): Promise<T> {
    const { llama, modele } = await this.charger()
    const grammaire = await llama.createGrammarForJsonSchema(versSchemaGrammaire(schema))
    const { LlamaChatSession } = await import('node-llama-cpp')
    const contexte = await modele.createContext()
    try {
      const session = new LlamaChatSession({ contextSequence: contexte.getSequence(), systemPrompt: systeme })
      const reponse = await session.prompt(utilisateur, { grammar: grammaire, temperature: 0.2 })
      return schema.parse(retirerNulls(grammaire.parse(reponse)))
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
