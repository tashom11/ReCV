import { decodeError } from '@core/channels'

// Every problem says what is happening and what to do: a short title, a sentence without jargon, an action.
// The raw technical message is never shown directly: it stays in « Détails », collapsed.

export type ErrorContext = 'cv' | 'posting' | 'generating' | 'export' | 'setup' | 'settings'

export type ErrorAction = 'paste-text' | 'retry' | 'choose-file' | 'finish-setup' | 'choose-folder' | 'dismiss'

export interface ErrorDescription {
  type: 'error' | 'info' | 'warning'
  icon: 'x-circle' | 'offline' | 'file-x' | 'warning' | 'restart' | 'folder-x'
  title: string
  text: string
  /** The first action is the recommended one. */
  actions: ErrorAction[]
  /** Original technical message, to collapse. */
  details: string
  code?: string
}

export const ACTION_LABELS: Record<ErrorAction, string> = {
  'paste-text': 'Coller le texte à la place',
  retry: 'Réessayer',
  'choose-file': 'Choisir un autre fichier',
  'finish-setup': 'Terminer la préparation',
  'choose-folder': 'Choisir un autre dossier',
  dismiss: 'Reprendre',
}

/** Code and message of an error coming from the main process (the code travels at the start of the message). */
export function readError(error: unknown): { code?: string; message: string } {
  return decodeError(error instanceof Error ? error.message : String(error))
}

/** Readable message of an error, without its code. */
export function messageErreur(error: unknown): string {
  return readError(error).message
}

export function isCancellation(error: unknown): boolean {
  return readError(error).code === 'cancelled'
}

const BLOCKED_SITE_CODES = new Set(['protected-site', 'http', 'empty-content', 'not-html'])

export function describeError(context: ErrorContext, error: unknown): ErrorDescription {
  const { code, message } = readError(error)
  const base = { details: message, code }

  // Valid at any step: nothing can be done until the setup is finished.
  if (code === 'engine-missing') {
    return {
      ...base,
      type: 'warning',
      icon: 'warning',
      title: 'Re:CV n’est pas encore tout à fait prêt',
      text: 'Il manque un téléchargement unique. Ensuite, plus besoin d’internet.',
      actions: ['finish-setup'],
    }
  }

  if (context === 'posting') {
    if (code === 'network') {
      return {
        ...base,
        type: 'info',
        icon: 'offline',
        title: 'Pas de connexion internet',
        text: 'Pour lire un lien, il faut internet. En collant le texte de l’annonce, tout fonctionne sans connexion.',
        actions: ['paste-text', 'retry'],
      }
    }
    if (code === 'invalid-url') {
      return {
        ...base,
        type: 'error',
        icon: 'x-circle',
        title: 'Cette adresse n’est pas complète',
        text: 'Une adresse d’annonce commence par https://. Copiez-la depuis la barre d’adresse de votre navigateur.',
        actions: ['paste-text'],
      }
    }
    if (code === 'local-network') {
      return {
        ...base,
        type: 'error',
        icon: 'x-circle',
        title: 'Cette adresse n’est pas celle d’une annonce',
        text: 'Elle mène à un appareil de votre ordinateur ou de votre réseau (box, imprimante…). Copiez l’adresse de l’annonce depuis votre navigateur, ou collez son texte.',
        actions: ['paste-text'],
      }
    }
    if (code && BLOCKED_SITE_CODES.has(code)) {
      return {
        ...base,
        type: 'error',
        icon: 'x-circle',
        title: 'Ce site ne nous laisse pas lire l’annonce',
        text: 'Ça arrive souvent, ce n’est pas grave. Copiez le texte de l’annonce sur la page, puis collez-le ici.',
        actions: ['paste-text'],
      }
    }
    return {
      ...base,
      type: 'error',
      icon: 'restart',
      title: 'La lecture de l’annonce s’est arrêtée en route',
      text: 'Rien n’est perdu : vous pouvez relancer tout de suite.',
      actions: ['retry'],
    }
  }

  if (context === 'cv') {
    if (code === 'unreadable-file') {
      return {
        ...base,
        type: 'error',
        icon: 'file-x',
        title: 'Nous n’arrivons pas à lire ce fichier',
        text: 'C’est souvent le cas d’un CV scanné ou pris en photo. Essayez la version Word, ou un PDF enregistré depuis Word.',
        actions: ['choose-file'],
      }
    }
    return {
      ...base,
      type: 'error',
      icon: 'restart',
      title: 'La lecture de votre CV s’est arrêtée en route',
      text: 'Votre fichier n’a pas été modifié. Vous pouvez relancer tout de suite.',
      actions: ['retry'],
    }
  }

  if (context === 'export') {
    return {
      ...base,
      type: 'error',
      icon: 'folder-x',
      title: 'Impossible d’enregistrer le CV ici',
      text: 'Le fichier est peut-être déjà ouvert, ou le dossier est protégé. Fermez le PDF s’il est ouvert, ou choisissez un autre dossier.',
      actions: ['choose-folder', 'retry'],
    }
  }

  if (context === 'setup') {
    return {
      ...base,
      type: 'error',
      icon: 'restart',
      title: 'Le téléchargement s’est interrompu',
      text: 'Ce qui est déjà téléchargé est gardé : il repartira là où il s’était arrêté.',
      actions: ['dismiss'],
    }
  }

  if (context === 'settings') {
    return {
      ...base,
      type: 'error',
      icon: 'x-circle',
      title: 'Ce réglage n’a pas pu être enregistré',
      text: 'Vérifiez ce que vous avez saisi, puis réessayez.',
      actions: [],
    }
  }

  return {
    ...base,
    type: 'error',
    icon: 'restart',
    title: 'La création s’est arrêtée en route',
    text: 'Rien n’est perdu : votre CV et l’annonce sont gardés. Vous pouvez relancer tout de suite.',
    actions: ['retry'],
  }
}
