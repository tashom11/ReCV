import { decodeError, encodeError } from '@core/channels'
import { describe, expect, it } from 'vitest'
import { describeError, isCancellation, messageErreur } from './errors'
import {
  announcedDuration,
  DEFAULT_ESTIMATE_S,
  elapsedLabel,
  formatSize,
  progressRatio,
  rate,
  readEstimate,
  remainingDownload,
  remainingGeneration,
  saveDuration,
} from './estimate'
import {
  afterStart,
  currentGenerationStep,
  doneSteps,
  engineReady,
  headerForView,
  initials,
  initialView,
  savedLocation,
  stepForView,
  titleWithoutGender,
  viewForStep,
} from './flow'

describe('flow', () => {
  it('opens on the welcome screen without a saved CV, otherwise directly on the job posting', () => {
    expect(initialView(false)).toBe('welcome')
    expect(initialView(true)).toBe('posting')
  })

  it('goes through the setup as long as the engine is not ready', () => {
    expect(afterStart(false)).toBe('setup')
    expect(afterStart(true)).toBe('cv')
  })

  it('considers the engine ready with a configured service or a present model', () => {
    expect(engineReady({ provider: 'local', localModelPath: undefined }, [{ installed: false }])).toBe(false)
    expect(engineReady({ provider: 'local', localModelPath: undefined }, [{ installed: true }])).toBe(true)
    expect(engineReady({ provider: 'local', localModelPath: 'C:\\m.gguf' }, [])).toBe(true)
    expect(engineReady({ provider: 'ollama', localModelPath: undefined }, [])).toBe(true)
    expect(engineReady({ provider: 'api', localModelPath: undefined }, [])).toBe(true)
  })

  it('links the views to the three steps', () => {
    expect(stepForView('cv')).toBe(1)
    expect(stepForView('posting')).toBe(2)
    expect(stepForView('generating')).toBe(3)
    expect(stepForView('result')).toBe(3)
    expect(stepForView('success')).toBeNull()
    expect(stepForView('settings')).toBeNull()
    expect([1, 2, 3].map((e) => viewForStep(e as 1 | 2 | 3))).toEqual(['cv', 'posting', 'result'])
  })

  it('only marks a step as done if the previous ones are', () => {
    expect(doneSteps({ profilePresent: false, postingConfirmed: true, exportedPath: true })).toEqual([])
    expect(doneSteps({ profilePresent: true, postingConfirmed: false, exportedPath: true })).toEqual([1])
    expect(doneSteps({ profilePresent: true, postingConfirmed: true, exportedPath: false })).toEqual([1, 2])
    expect(doneSteps({ profilePresent: true, postingConfirmed: true, exportedPath: true })).toEqual([1, 2, 3])
  })

  it('hides the steps on the welcome screen and the settings during a wait', () => {
    expect(headerForView('welcome')).toEqual({ steps: false, settings: true })
    expect(headerForView('setup')).toEqual({ steps: false, settings: false })
    expect(headerForView('generating')).toEqual({ steps: true, settings: false })
    expect(headerForView('success')).toEqual({ steps: true, settings: false })
    expect(headerForView('posting')).toEqual({ steps: true, settings: true })
  })

  it('follows the generation steps, the job posting already read counting as done', () => {
    expect(currentGenerationStep(undefined, false, false)).toBe(0)
    expect(currentGenerationStep('analysis', false, false)).toBe(0)
    expect(currentGenerationStep('setup', true, false)).toBe(1)
    expect(currentGenerationStep('selection', true, false)).toBe(1)
    expect(currentGenerationStep('rewriting', false, false)).toBe(1)
    expect(currentGenerationStep('summary', true, false)).toBe(2)
    expect(currentGenerationStep('summary', true, true)).toBe(3)
  })

  it('says simply where the file is saved', () => {
    expect(savedLocation('C:\\Users\\Camille\\Desktop\\CV-Camille-Martin.pdf')).toEqual({
      file: 'CV-Camille-Martin.pdf',
      place: 'Enregistré sur votre Bureau',
    })
    expect(savedLocation('C:\\Users\\Camille\\Documents\\cv.docx').place).toBe('Enregistré dans vos Documents')
    expect(savedLocation('D:\\Candidatures\\cv.pdf').place).toBe('Enregistré dans le dossier « Candidatures »')
    expect(savedLocation('cv.pdf').place).toBe('Enregistré sur votre ordinateur')
  })

  it('quotes the position without the (H/F) mention', () => {
    expect(titleWithoutGender('Agent d’accueil polyvalent (H/F)')).toBe('Agent d’accueil polyvalent')
    expect(titleWithoutGender('Développeur [F/H/X] React')).toBe('Développeur React')
    expect(titleWithoutGender('Peintre H/F')).toBe('Peintre')
    expect(titleWithoutGender('Peintre - F/H en bâtiment')).toBe('Peintre en bâtiment')
    expect(titleWithoutGender('Agent CAF/Habitat')).toBe('Agent CAF/Habitat')
    expect(titleWithoutGender('Comptable')).toBe('Comptable')
    expect(titleWithoutGender('(H/F)')).toBe('(H/F)')
  })

  it('takes the initials of the name', () => {
    expect(initials('Camille Martin')).toBe('CM')
    expect(initials('  jean-pierre de la fontaine ')).toBe('JF')
    expect(initials('Camille')).toBe('C')
    expect(initials(undefined)).toBe('')
  })
})

describe('errors', () => {
  const error = (code: string | undefined, message = 'détail technique') => new Error(encodeError(message, code))

  it('makes the code travel at the start of the message and removes it for display', () => {
    expect(decodeError(encodeError('Création annulée.', 'cancelled'))).toEqual({
      code: 'cancelled',
      message: 'Création annulée.',
    })
    expect(decodeError('Message [[sans]] code')).toEqual({ message: 'Message [[sans]] code' })
    expect(messageErreur(error('network', 'site injoignable'))).toBe('site injoignable')
    expect(isCancellation(error('cancelled'))).toBe(true)
    expect(isCancellation(error(undefined))).toBe(false)
  })

  it('offers to paste the text when the site blocks reading', () => {
    for (const code of ['protected-site', 'http', 'empty-content', 'not-html']) {
      const d = describeError('posting', error(code))
      expect(d.title).toBe('Ce site ne nous laisse pas lire l’annonce')
      expect(d.actions).toEqual(['paste-text'])
      expect(d.details).toBe('détail technique')
    }
  })

  it('distingue l’absence de connexion, sur un ton d’information', () => {
    const d = describeError('posting', error('network'))
    expect(d.type).toBe('info')
    expect(d.title).toBe('Pas de connexion internet')
    expect(d.actions).toEqual(['paste-text', 'retry'])
  })

  it('explains that a local network address is not a job posting, and offers to paste the text', () => {
    const d = describeError('posting', error('local-network'))
    expect(d.title).toBe('Cette adresse n’est pas celle d’une annonce')
    expect(d.actions).toEqual(['paste-text'])
  })

  it('sends to the setup when the engine is missing, whatever the step', () => {
    for (const context of ['cv', 'posting', 'generating'] as const) {
      const d = describeError(context, error('engine-missing'))
      expect(d.type).toBe('warning')
      expect(d.actions).toEqual(['finish-setup'])
    }
  })

  it('gives an action in every other case, never repeating the technical message in the text', () => {
    expect(describeError('cv', error('unreadable-file')).actions).toEqual(['choose-file'])
    expect(describeError('export', error('write-failed')).actions).toEqual(['choose-folder', 'retry'])
    expect(describeError('generating', error(undefined)).title).toBe('La création s’est arrêtée en route')
    expect(describeError('setup', error(undefined)).actions).toEqual(['dismiss'])
    for (const context of ['cv', 'posting', 'generating', 'export', 'setup', 'settings'] as const) {
      const d = describeError(context, error(undefined, 'ECONNRESET at TLSSocket'))
      expect(`${d.title} ${d.text}`).not.toContain('ECONNRESET')
      expect(d.details).toContain('ECONNRESET')
    }
  })
})

describe('estimate', () => {
  const storage = () => {
    const values = new Map<string, string>()
    return { getItem: (c: string) => values.get(c) ?? null, setItem: (c: string, v: string) => void values.set(c, v) }
  }

  it('takes the duration of the previous creation, otherwise two minutes', () => {
    const s = storage()
    expect(readEstimate(s)).toBe(DEFAULT_ESTIMATE_S)
    saveDuration(s, 187.4)
    expect(readEstimate(s)).toBe(187)
    saveDuration(s, 0)
    expect(readEstimate(s)).toBe(187)
    saveDuration(s, 4)
    expect(readEstimate(s)).toBe(20)
  })

  it('announces durations in round minutes', () => {
    expect(announcedDuration(120)).toBe('Environ 2 minutes')
    expect(announcedDuration(70)).toBe('Environ 1 minute')
    expect(announcedDuration(30)).toBe('Moins d’une minute')
    expect(remainingGeneration(65, 120)).toBe('Encore environ 1 minute')
    expect(remainingGeneration(0, 300)).toBe('Encore environ 5 minutes')
    expect(remainingGeneration(100, 120)).toBe('Encore moins d’une minute')
    expect(remainingGeneration(200, 120)).toBe('Presque terminé')
    expect(elapsedLabel(65)).toBe('Depuis 1 min 05 s')
    expect(elapsedLabel(9)).toBe('Depuis 9 s')
  })

  it('never fills the bar before the end', () => {
    expect(progressRatio(60, 120)).toBe(0.5)
    expect(progressRatio(500, 120)).toBe(0.95)
    expect(progressRatio(10, 0)).toBe(0)
  })

  it('writes sizes and the remaining download time', () => {
    expect(formatSize(2_740_937_888)).toBe('2,6 Go')
    expect(formatSize(1_280_835_840)).toBe('1,2 Go')
    expect(formatSize(500 * 1024 ** 2)).toBe('500 Mo')
    const d = rate({ bytes: 0, atMs: 0 }, { bytes: 50_000_000, atMs: 10_000 })
    expect(d).toBe(5_000_000)
    expect(rate({ bytes: 0, atMs: 0 }, { bytes: 10, atMs: 1_000 })).toBeNull()
    expect(remainingDownload(1_000_000_000, 2_800_000_000, d)).toBe('environ 6 minutes restantes')
    expect(remainingDownload(2_700_000_000, 2_800_000_000, d)).toBe('moins d’une minute restante')
    expect(remainingDownload(0, 100, null)).toBeNull()
  })
})
