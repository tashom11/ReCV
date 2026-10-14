import type { CSSProperties } from 'react'
import { Icon } from './icons'

// Animated lines: each starts a little after the previous one, like text being written.
const written = (animated: boolean, rank: number) =>
  animated ? { className: 'ligne-ecrite', style: { '--rang': rank } as CSSProperties } : { className: '' }

/** Stylised CV page, slightly tilted: illustration of the welcome and generating screens. */
export function CvIllustration({
  withBackground = false,
  check = false,
  animated = false,
}: {
  withBackground?: boolean
  check?: boolean
  /** Badges and lines are written in a loop (waiting screen). */
  animated?: boolean
}) {
  const line = (rank: number, classes: string) => {
    const { className, style } = written(animated, rank)
    return { className: `${classes} ${className}`, style }
  }
  return (
    <div className="relative mx-auto w-[300px]" aria-hidden="true">
      {withBackground && (
        <div className="absolute -top-2 -left-28 h-[400px] w-[280px] -rotate-[4deg] space-y-3 rounded-carte border border-trait bg-surface p-7 pt-8">
          <div className="h-3 w-3/5 rounded-full bg-trait-fort/45" />
          <div className="h-2.5 w-2/5 rounded-full bg-trait" />
          <div className="h-6" />
          {['w-3/5', 'w-1/2', 'w-3/5', 'w-1/2', 'w-2/5'].map((maxWidth, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative lines
            <div key={i} className={`h-2 rounded-full bg-trait ${maxWidth}`} />
          ))}
        </div>
      )}
      <div className="relative h-[420px] rotate-[2deg] rounded-panneau border-2 border-encre bg-surface p-8 shadow-panneau">
        <div className="flex items-center gap-4">
          <span className="size-12 shrink-0 rounded-full border-2 border-marque bg-marque-pale" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-4/5 rounded-full bg-encre" />
            <span className="block h-2.5 w-3/5 rounded-full bg-marque" />
          </span>
        </div>
        <div className="mt-8 flex gap-2">
          <span {...line(0, 'h-5 w-[72px] rounded-full bg-accent')} />
          <span {...line(1, 'h-5 w-14 rounded-full bg-accent')} />
          <span {...line(2, `h-5 w-[88px] rounded-full ${withBackground ? 'bg-accent' : 'bg-creux'}`)} />
        </div>
        <div className="mt-7 space-y-3">
          {['w-full', 'w-11/12', 'w-full', 'w-3/5'].map((maxWidth, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative lines
            <div key={i} {...line(3 + i, `h-2 rounded-full bg-marque/20 ${maxWidth}`)} />
          ))}
        </div>
        <div className="mt-8 space-y-3">
          <div {...line(7, 'h-2 w-full rounded-full bg-creux')} />
          <div {...line(8, 'h-2 w-4/5 rounded-full bg-creux')} />
        </div>
      </div>
      {check && (
        <span className="absolute -right-4 -bottom-5 flex size-[68px] items-center justify-center rounded-full bg-marque text-white shadow-panneau">
          <Icon name="check" size={30} strokeWidth={3} />
        </span>
      )}
    </div>
  )
}
