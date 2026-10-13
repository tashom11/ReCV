import { decoderErreur } from '@core/canaux'

// Chaque problème dit ce qui se passe, et quoi faire : un titre court, une phrase sans jargon, une action.
// Le message technique brut ne s'affiche jamais directement : il reste dans « Détails », replié.

export type ContexteErreur = 'cv' | 'annonce' | 'creation' | 'export' | 'preparation' | 'reglages'

export type ActionErreur =
  | 'coller-texte'
  | 'reessayer'
  | 'choisir-fichier'
  | 'terminer-preparation'
  | 'choisir-dossier'
  | 'reprendre'

export interface DescriptionErreur {
  type: 'erreur' | 'info' | 'avertissement'
  icone: 'croix-cercle' | 'hors-ligne' | 'fichier-croix' | 'alerte' | 'recommencer' | 'dossier-croix'
  titre: string
  texte: string
  /** La première action est celle conseillée. */
  actions: ActionErreur[]
  /** Message technique d'origine, à replier. */
  details: string
  code?: string
}

export const LIBELLES_ACTIONS: Record<ActionErreur, string> = {
  'coller-texte': 'Coller le texte à la place',
  reessayer: 'Réessayer',
  'choisir-fichier': 'Choisir un autre fichier',
  'terminer-preparation': 'Terminer la préparation',
  'choisir-dossier': 'Choisir un autre dossier',
  reprendre: 'Reprendre',
}

/** Code et message d'une erreur venue du process principal (le code voyage en tête du message). */
export function lireErreur(erreur: unknown): { code?: string; message: string } {
  return decoderErreur(erreur instanceof Error ? erreur.message : String(erreur))
}

/** Message lisible d'une erreur, sans son code. */
export function messageErreur(erreur: unknown): string {
  return lireErreur(erreur).message
}

export function estAnnulation(erreur: unknown): boolean {
  return lireErreur(erreur).code === 'annule'
}

const SITE_BLOQUE = new Set(['site-protege', 'http', 'contenu-vide', 'contenu-non-html'])

export function decrireErreur(contexte: ContexteErreur, erreur: unknown): DescriptionErreur {
  const { code, message } = lireErreur(erreur)
  const base = { details: message, code }

  // Valable à toute étape : rien ne peut se faire tant que la préparation n'est pas terminée.
  if (code === 'moteur-absent') {
    return {
      ...base,
      type: 'avertissement',
      icone: 'alerte',
      titre: 'Re:CV n’est pas encore tout à fait prêt',
      texte: 'Il manque un téléchargement unique. Ensuite, plus besoin d’internet.',
      actions: ['terminer-preparation'],
    }
  }

  if (contexte === 'annonce') {
    if (code === 'reseau') {
      return {
        ...base,
        type: 'info',
        icone: 'hors-ligne',
        titre: 'Pas de connexion internet',
        texte: 'Pour lire un lien, il faut internet. En collant le texte de l’annonce, tout fonctionne sans connexion.',
        actions: ['coller-texte', 'reessayer'],
      }
    }
    if (code === 'url-invalide') {
      return {
        ...base,
        type: 'erreur',
        icone: 'croix-cercle',
        titre: 'Cette adresse n’est pas complète',
        texte: 'Une adresse d’annonce commence par https://. Copiez-la depuis la barre d’adresse de votre navigateur.',
        actions: ['coller-texte'],
      }
    }
    if (code && SITE_BLOQUE.has(code)) {
      return {
        ...base,
        type: 'erreur',
        icone: 'croix-cercle',
        titre: 'Ce site ne nous laisse pas lire l’annonce',
        texte: 'Ça arrive souvent, ce n’est pas grave. Copiez le texte de l’annonce sur la page, puis collez-le ici.',
        actions: ['coller-texte'],
      }
    }
    return {
      ...base,
      type: 'erreur',
      icone: 'recommencer',
      titre: 'La lecture de l’annonce s’est arrêtée en route',
      texte: 'Rien n’est perdu : vous pouvez relancer tout de suite.',
      actions: ['reessayer'],
    }
  }

  if (contexte === 'cv') {
    if (code === 'fichier-illisible') {
      return {
        ...base,
        type: 'erreur',
        icone: 'fichier-croix',
        titre: 'Nous n’arrivons pas à lire ce fichier',
        texte:
          'C’est souvent le cas d’un CV scanné ou pris en photo. Essayez la version Word, ou un PDF enregistré depuis Word.',
        actions: ['choisir-fichier'],
      }
    }
    return {
      ...base,
      type: 'erreur',
      icone: 'recommencer',
      titre: 'La lecture de votre CV s’est arrêtée en route',
      texte: 'Votre fichier n’a pas été modifié. Vous pouvez relancer tout de suite.',
      actions: ['reessayer'],
    }
  }

  if (contexte === 'export') {
    return {
      ...base,
      type: 'erreur',
      icone: 'dossier-croix',
      titre: 'Impossible d’enregistrer le CV ici',
      texte:
        'Le fichier est peut-être déjà ouvert, ou le dossier est protégé. Fermez le PDF s’il est ouvert, ou choisissez un autre dossier.',
      actions: ['choisir-dossier', 'reessayer'],
    }
  }

  if (contexte === 'preparation') {
    return {
      ...base,
      type: 'erreur',
      icone: 'recommencer',
      titre: 'Le téléchargement s’est interrompu',
      texte: 'Ce qui est déjà téléchargé est gardé : il repartira là où il s’était arrêté.',
      actions: ['reprendre'],
    }
  }

  if (contexte === 'reglages') {
    return {
      ...base,
      type: 'erreur',
      icone: 'croix-cercle',
      titre: 'Ce réglage n’a pas pu être enregistré',
      texte: 'Vérifiez ce que vous avez saisi, puis réessayez.',
      actions: [],
    }
  }

  return {
    ...base,
    type: 'erreur',
    icone: 'recommencer',
    titre: 'La création s’est arrêtée en route',
    texte: 'Rien n’est perdu : votre CV et l’annonce sont gardés. Vous pouvez relancer tout de suite.',
    actions: ['reessayer'],
  }
}
