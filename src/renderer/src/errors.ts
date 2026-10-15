import { decodeError } from '@core/channels'
import { texts } from './i18n'

// Every problem says what is happening and what to do: a short title, a sentence without jargon, an action.
// The raw technical message is never shown directly: it stays in « Détails », collapsed.

export type ErrorContext = 'cv' | 'posting' | 'generating' | 'export' | 'setup' | 'settings'

export type ErrorAction =
  | 'paste-text'
  | 'retry'
  | 'choose-file'
  | 'finish-setup'
  | 'open-settings'
  | 'choose-folder'
  | 'dismiss'

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

export const ACTION_LABELS: Record<ErrorAction, string> = texts.errors.actions

/** Label of an action button: shorter when it is not the recommended action. */
export function actionLabel(action: ErrorAction, recommended: boolean): string {
  return (!recommended && texts.errors.secondaryActions[action]) || ACTION_LABELS[action]
}

/** Code and message of an error coming from the main process (the code travels at the start of the message). */
export function readError(error: unknown): { code?: string; message: string } {
  return decodeError(error instanceof Error ? error.message : String(error))
}

/** Readable message of an error, without its code. */
export function errorMessage(error: unknown): string {
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
      ...texts.errors.engineMissing,
      actions: ['finish-setup'],
    }
  }

  if (context === 'posting') {
    if (code === 'network') {
      return {
        ...base,
        type: 'info',
        icon: 'offline',
        ...texts.errors.posting.network,
        actions: ['paste-text', 'retry'],
      }
    }
    if (code === 'invalid-url') {
      return {
        ...base,
        type: 'error',
        icon: 'x-circle',
        ...texts.errors.posting.invalidUrl,
        actions: ['paste-text'],
      }
    }
    if (code === 'local-network') {
      return {
        ...base,
        type: 'error',
        icon: 'x-circle',
        ...texts.errors.posting.localNetwork,
        actions: ['paste-text'],
      }
    }
    if (code && BLOCKED_SITE_CODES.has(code)) {
      return {
        ...base,
        type: 'error',
        icon: 'x-circle',
        ...texts.errors.posting.blockedSite,
        actions: ['paste-text'],
      }
    }
    return {
      ...base,
      type: 'error',
      icon: 'restart',
      ...texts.errors.posting.interrupted,
      actions: ['retry'],
    }
  }

  if (context === 'cv') {
    if (code === 'extraction-empty') {
      return {
        ...base,
        type: 'warning',
        icon: 'warning',
        ...texts.errors.cv.emptyExtraction,
        actions: ['open-settings', 'retry'],
      }
    }
    if (code === 'unreadable-file') {
      return {
        ...base,
        type: 'error',
        icon: 'file-x',
        ...texts.errors.cv.unreadable,
        actions: ['choose-file'],
      }
    }
    return {
      ...base,
      type: 'error',
      icon: 'restart',
      ...texts.errors.cv.interrupted,
      actions: ['retry'],
    }
  }

  if (context === 'export') {
    return {
      ...base,
      type: 'error',
      icon: 'folder-x',
      ...texts.errors.export,
      actions: ['choose-folder', 'retry'],
    }
  }

  if (context === 'setup') {
    return {
      ...base,
      type: 'error',
      icon: 'restart',
      ...texts.errors.setup,
      actions: ['dismiss'],
    }
  }

  if (context === 'settings') {
    return {
      ...base,
      type: 'error',
      icon: 'x-circle',
      ...texts.errors.settings,
      actions: [],
    }
  }

  return {
    ...base,
    type: 'error',
    icon: 'restart',
    ...texts.errors.generating,
    actions: ['retry'],
  }
}
