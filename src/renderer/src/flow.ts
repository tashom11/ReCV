import type { Settings } from '@core/api'
import type { StepKey } from '@core/steps'

// Rules of the three-step flow, without React nor access to the application: testable on their own.

export type View = 'welcome' | 'setup' | 'cv' | 'posting' | 'generating' | 'result' | 'success' | 'settings'
export type StepNumber = 1 | 2 | 3

export interface FlowState {
  profilePresent: boolean
  /** The job posting has been read and confirmed with « Créer mon CV adapté ». */
  postingConfirmed: boolean
  /** A tailored CV has been downloaded. */
  exported: boolean
}

/** On opening: the welcome screen only if there is no CV yet, otherwise directly the job posting. */
export function initialView(profilePresent: boolean): View {
  return profilePresent ? 'posting' : 'welcome'
}

/** The engine can work: configured service, or model present on the computer. */
export function engineReady(
  settings: Pick<Settings, 'provider' | 'localModelPath'>,
  models: readonly { installed: boolean }[],
): boolean {
  if (settings.provider !== 'local') return true
  return Boolean(settings.localModelPath) || models.some((m) => m.installed)
}

/** After « Commencer »: the setup if the engine is missing, otherwise step ①. */
export function afterStart(ready: boolean): View {
  return ready ? 'cv' : 'setup'
}

export function stepForView(view: View): StepNumber | null {
  switch (view) {
    case 'cv':
      return 1
    case 'posting':
      return 2
    case 'generating':
    case 'result':
      return 3
    default:
      return null
  }
}

export function viewForStep(step: StepNumber): View {
  return step === 1 ? 'cv' : step === 2 ? 'posting' : 'result'
}

export function doneSteps(state: FlowState): StepNumber[] {
  const done: StepNumber[] = []
  if (state.profilePresent) done.push(1)
  if (state.profilePresent && state.postingConfirmed) done.push(2)
  if (done.length === 2 && state.exported) done.push(3)
  return done
}

/** What the header shows for a view: the steps are off-topic on the welcome screen, the settings during a wait. */
export function headerForView(view: View): { steps: boolean; settings: boolean } {
  return {
    steps: view !== 'welcome' && view !== 'setup' && view !== 'settings',
    settings: view !== 'setup' && view !== 'generating' && view !== 'success' && view !== 'settings',
  }
}

/** Generation steps, in the user's words. */
export const GENERATION_STEPS = [
  'Je lis l’annonce',
  'Je choisis ce qui vous met en valeur',
  'J’écris votre phrase de présentation',
  'Je mets votre CV en page',
] as const

const STEP_RANK: Record<StepKey, number> = { setup: 0, analysis: 0, selection: 1, rewriting: 1, summary: 2 }

/**
 * Rank (0 to 3) of the current generation step. The job posting already read at step ② is not read again: the first
 * line is then done from the start.
 */
export function currentGenerationStep(key: StepKey | undefined, postingRead: boolean, layingOut: boolean): number {
  if (layingOut) return 3
  const rank = key ? STEP_RANK[key] : 0
  return postingRead ? Math.max(1, rank) : rank
}

const KNOWN_FOLDERS: Record<string, string> = {
  desktop: 'sur votre Bureau',
  bureau: 'sur votre Bureau',
  documents: 'dans vos Documents',
  downloads: 'dans vos Téléchargements',
  téléchargements: 'dans vos Téléchargements',
}

/** File name and save folder, said simply (« Enregistré sur votre Bureau »). */
export function savedLocation(path: string): { file: string; place: string } {
  const parts = path.split(/[\\/]/).filter(Boolean)
  const file = parts.pop() ?? path
  const dossier = parts.pop()
  if (!dossier) return { file, place: 'Enregistré sur votre ordinateur' }
  const known = KNOWN_FOLDERS[dossier.toLowerCase()]
  return { file, place: known ? `Enregistré ${known}` : `Enregistré dans le dossier « ${dossier} »` }
}

/** Initials shown in the summary badge (« Camille Martin » → « CM »). */
export function initials(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.charAt(0) ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toLocaleUpperCase('fr-FR')
}

/** « 3 expériences », « 1 formation »: the number and the agreed noun, separate so that the number can be bold. */
export function countOf(count: number, singular: string, plural: string): { count: number; name: string } {
  return { count, name: count > 1 ? plural : singular }
}

/** Job title without the « H/F » mention, with or without brackets: to quote it in a sentence. */
export function titleWithoutGender(title: string): string {
  const without = title
    .replace(/\s*[-–—]?\s*[([]?\s*\b[hfx]\s*\/\s*[hfx](\s*\/\s*[hfx])?\b\s*[)\]]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return without || title
}
