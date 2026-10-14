// Durations said simply: an honest estimate rather than a stopwatch to the second.
import { texts } from './i18n'

/** Assumed duration of a creation as long as none has been measured on this computer. */
export const DEFAULT_ESTIMATE_S = 120
/** Beyond this, the generating screen warns that it is taking longer than expected. */
export const LONG_THRESHOLD_S = 300

const DURATION_KEY = 'recv.dureeCreation'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Estimate of a creation: the duration of the previous one on this computer, bounded, otherwise the default. */
export function readEstimate(storage: KeyValueStorage): number {
  const raw = Number(storage.getItem(DURATION_KEY))
  return Number.isFinite(raw) && raw > 0 ? Math.min(900, Math.max(20, raw)) : DEFAULT_ESTIMATE_S
}

export function saveDuration(storage: KeyValueStorage, seconds: number): void {
  if (seconds > 0) storage.setItem(DURATION_KEY, String(Math.round(seconds)))
}

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

/** « Environ 2 minutes »: duration announced before starting. */
export function announcedDuration(estimateS: number): string {
  return estimateS < 45 ? texts.duration.lessThanAMinute : texts.duration.about(minutes(estimateS))
}

/** « Encore environ 1 minute »: what remains, never showing zero nor a countdown. */
export function remainingGeneration(elapsedS: number, estimateS: number): string {
  const rest = estimateS - elapsedS
  if (rest <= 0) return texts.duration.almostDone
  if (rest < 45) return texts.duration.lessThanAMinuteLeft
  return texts.duration.aboutLeft(minutes(rest))
}

/** « Depuis 1 min 05 s ». */
export function elapsedLabel(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m === 0 ? texts.duration.elapsedSeconds(s) : texts.duration.elapsed(m, String(s).padStart(2, '0'))
}

/** Filled part of the bar (0 to 1): it moves with time but never claims to be finished before the end. */
export function progressRatio(elapsedS: number, estimateS: number): number {
  if (estimateS <= 0) return 0
  return Math.min(0.95, elapsedS / estimateS)
}

/** « 2,6 Go », « 850 Mo »: sizes written the French way. */
export function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1).replace('.', ',')} Go`
  return `${Math.round(bytes / 1024 ** 2)} Mo`
}

/** Average rate (bytes per second) between two readings; `null` while it is too early to tell. */
export function rate(start: { bytes: number; atMs: number }, now: { bytes: number; atMs: number }): number | null {
  const duration = (now.atMs - start.atMs) / 1000
  const receivedCount = now.bytes - start.bytes
  return duration >= 3 && receivedCount > 0 ? receivedCount / duration : null
}

/** « environ 6 minutes restantes », or `null` without a known rate. */
export function remainingDownload(
  receivedBytes: number,
  totalBytes: number,
  bytesPerSecond: number | null,
): string | null {
  if (!bytesPerSecond || totalBytes <= receivedBytes) return null
  const seconds = (totalBytes - receivedBytes) / bytesPerSecond
  if (seconds < 45) return texts.download.lessThanAMinuteLeft
  return texts.download.minutesLeft(minutes(seconds))
}
