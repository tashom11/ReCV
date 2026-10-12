// Teste le pipeline complet hors Electron :
//   npm run essai -- cv.txt offre.txt [--fournisseur ollama|api|local] [--modele nom]
// Configuration par variables d'environnement (jamais de clé en argument) :
//   RECV_OLLAMA_URL  (défaut http://localhost:11434/v1)
//   RECV_API_URL, RECV_API_CLE  (fournisseur « api », OpenAI-compatible)
//   RECV_MODELE_GGUF  (fournisseur « local », chemin du fichier .gguf)
// Le CvAdapte JSON est écrit sur stdout, la progression sur stderr.
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { creerFournisseurApi, creerFournisseurOllama, type FournisseurLLM } from '../src/core/llm'

const MODELE_OLLAMA_DEFAUT = 'qwen3:8b'

function variableRequise(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`variable d'environnement ${nom} manquante`)
  return valeur
}

async function creerFournisseur(fournisseur: string, modele: string | undefined): Promise<FournisseurLLM> {
  switch (fournisseur) {
    case 'ollama':
      return creerFournisseurOllama({ modele: modele ?? MODELE_OLLAMA_DEFAUT, urlBase: process.env.RECV_OLLAMA_URL })
    case 'api':
      if (!modele) throw new Error('--modele est obligatoire avec --fournisseur api')
      return creerFournisseurApi({
        urlBase: variableRequise('RECV_API_URL'),
        cleApi: variableRequise('RECV_API_CLE'),
        modele,
      })
    case 'local': {
      const { creerFournisseurLocal } = await import('../src/core/llm/moteurLocal')
      return creerFournisseurLocal({ cheminModele: variableRequise('RECV_MODELE_GGUF') })
    }
    default:
      throw new Error(`fournisseur inconnu « ${fournisseur} » (ollama, api ou local)`)
  }
}

async function chronometrer<T>(etiquette: string, tache: () => Promise<T>): Promise<T> {
  process.stderr.write(`${etiquette}… `)
  const debut = performance.now()
  const resultat = await tache()
  process.stderr.write(`${((performance.now() - debut) / 1000).toFixed(1)} s\n`)
  return resultat
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      fournisseur: { type: 'string', default: 'ollama' },
      modele: { type: 'string' },
    },
  })
  const [cheminCv, cheminOffre] = positionals
  if (!cheminCv || !cheminOffre) {
    throw new Error('usage : npm run essai -- cv.txt offre.txt [--fournisseur ollama|api|local] [--modele nom]')
  }
  const [texteCv, texteOffre] = await Promise.all([readFile(cheminCv, 'utf8'), readFile(cheminOffre, 'utf8')])
  const fournisseur = await creerFournisseur(values.fournisseur, values.modele)

  const profil = await chronometrer('Extraction du profil', () => fournisseur.extraireProfil(texteCv))
  const offre = await chronometrer("Extraction de l'offre", () => fournisseur.extraireOffre(texteOffre))
  const cv = await chronometrer('Adaptation du CV', () => fournisseur.adapterCv(profil, offre))
  process.stdout.write(`${JSON.stringify(cv, null, 2)}\n`)
}

main().catch((erreur: unknown) => {
  process.stderr.write(`\nErreur : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
  process.exitCode = 1
})
