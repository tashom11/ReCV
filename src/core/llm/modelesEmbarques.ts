// Catalogue des modèles embarqués (GGUF quantifiés Q4_K_M, dépôts « unsloth » sur Hugging Face).
// La taille et l'empreinte SHA-256 proviennent des métadonnées LFS du dépôt : le fichier est vérifié après téléchargement.

export interface ModeleEmbarque {
  id: string
  nom: string
  description: string
  fichier: string
  url: string
  tailleOctets: number
  sha256: string
  /**
   * Mémoire à partir de laquelle le modèle est confortable : VRAM (GPU, poids + contexte) ou RAM système (CPU).
   * Sur CPU un modèle de 9B génère quelques jetons par seconde : seul le GPU le rend utilisable.
   */
  ramMinGo: number
  vramMinGo: number
}

const depot = (taille: string, fichier: string) =>
  `https://huggingface.co/unsloth/Qwen3.5-${taille}-GGUF/resolve/main/${fichier}`

export const MODELES_EMBARQUES: readonly ModeleEmbarque[] = [
  {
    id: 'qwen3.5-2b',
    nom: 'Qwen3.5 2B',
    description: 'Léger et rapide, pour les ordinateurs modestes. Qualité de rédaction correcte.',
    fichier: 'Qwen3.5-2B-Q4_K_M.gguf',
    url: depot('2B', 'Qwen3.5-2B-Q4_K_M.gguf'),
    tailleOctets: 1_280_835_840,
    sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
    ramMinGo: 4,
    vramMinGo: 3,
  },
  {
    id: 'qwen3.5-4b',
    nom: 'Qwen3.5 4B',
    description: 'Bon compromis vitesse / qualité pour la plupart des ordinateurs récents.',
    fichier: 'Qwen3.5-4B-Q4_K_M.gguf',
    url: depot('4B', 'Qwen3.5-4B-Q4_K_M.gguf'),
    tailleOctets: 2_740_937_888,
    sha256: '00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
    ramMinGo: 8,
    vramMinGo: 5,
  },
  {
    id: 'qwen3.5-9b',
    nom: 'Qwen3.5 9B',
    description: 'Meilleure qualité, plus lent : pour les machines avec beaucoup de mémoire ou une carte graphique.',
    fichier: 'Qwen3.5-9B-Q4_K_M.gguf',
    url: depot('9B', 'Qwen3.5-9B-Q4_K_M.gguf'),
    tailleOctets: 5_680_522_464,
    sha256: '03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8',
    ramMinGo: 64,
    vramMinGo: 10,
  },
]

export interface Ressources {
  ramGo: number
  vramGo: number
}

export function modeleCompatible(modele: ModeleEmbarque, { ramGo, vramGo }: Ressources): boolean {
  return vramGo >= modele.vramMinGo || ramGo >= modele.ramMinGo
}

/** Le plus gros modèle supporté ; à défaut, le plus petit (mieux vaut lent que rien). */
export function proposerModele(ressources: Ressources): ModeleEmbarque {
  const compatibles = MODELES_EMBARQUES.filter((m) => modeleCompatible(m, ressources))
  const choisi = compatibles[compatibles.length - 1] ?? MODELES_EMBARQUES[0]
  if (!choisi) throw new Error('Catalogue de modèles vide')
  return choisi
}
