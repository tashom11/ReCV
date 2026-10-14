import { formatDuration, useElapsedSeconds } from '../progress'
import { Spinner } from './icons'

/**
 * « Working » block for short waits inside a screen: current step, elapsed time and progress bar (determinate if
 * `current`/`total` are known, otherwise indeterminate).
 */
export function Loading({
  title,
  step,
  current,
  total,
  note,
}: {
  title: string
  step?: string
  current?: number
  total?: number
  note?: string
}) {
  const seconds = useElapsedSeconds(true)
  const determinate = current !== undefined && total !== undefined && total > 0
  return (
    <div role="status" aria-live="polite" className="space-y-3 rounded-carte border border-trait bg-surface p-5">
      <div className="flex items-center gap-3 text-encre">
        <span className="text-marque">
          <Spinner size={22} />
        </span>
        <div className="flex-1">
          <p className="font-bold">{title}</p>
          {step && (
            <p className="text-petit text-aide">
              {step}
              {determinate ? ` (${current}/${total})` : ''}
            </p>
          )}
        </div>
        <span className="text-petit tabular-nums text-aide" aria-hidden="true">
          {formatDuration(seconds)}
        </span>
      </div>
      {/* Indeterminate while the total is unknown: no aria-valuenow then (WAI-ARIA). */}
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? total : undefined}
        aria-valuenow={determinate ? current : undefined}
        className="h-2.5 overflow-hidden rounded-full bg-creux"
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-marque transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round(((current ?? 0) / (total ?? 1)) * 100))}%` }}
          />
        ) : (
          <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
        )}
      </div>
      {note && <p className="text-petit text-aide">{note}</p>}
    </div>
  )
}
