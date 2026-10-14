import { type ReactNode, useEffect, useRef } from 'react'
import { Icon, type IconName } from './icons'

type AlertType = 'error' | 'info' | 'warning' | 'success'

const STYLES: Record<AlertType, { background: string; text: string; badge: string; icon: IconName }> = {
  error: {
    background: 'border-erreur/35 bg-erreur-fond',
    text: 'text-erreur',
    badge: 'bg-erreur',
    icon: 'x-circle',
  },
  info: { background: 'border-info/30 bg-info-fond', text: 'text-info', badge: 'bg-info', icon: 'info' },
  warning: { background: 'border-alerte/35 bg-alerte-fond', text: 'text-alerte', badge: 'bg-alerte', icon: 'warning' },
  success: { background: 'border-succes/35 bg-succes-fond', text: 'text-succes', badge: 'bg-succes', icon: 'check' },
}

/**
 * Status message. With a `title`: icon badge, title, explanation and actions (« what is happening, and what to do »).
 * Without a title: compact banner. Colour never carries the information alone: each type has its icon.
 */
export function Alert({
  type,
  title,
  icon,
  actions,
  children,
  headingLevel = 2,
}: {
  type: AlertType
  title?: string
  icon?: IconName
  /** Offered buttons; the first one is the recommended action. */
  actions?: ReactNode
  children?: ReactNode
  /** Title level in the page outline: 3 inside a card titled with an h2. */
  headingLevel?: 2 | 3
}) {
  const style = STYLES[type]
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusesTitle = type === 'error' && Boolean(title)

  // An error moves the focus to its title: the offered action is then the first button reached with the keyboard.
  useEffect(() => {
    if (focusesTitle) titleRef.current?.focus()
  }, [focusesTitle])

  // The focus move already makes screen readers read the title: a live role on top would announce it twice.
  const role = focusesTitle ? undefined : type === 'error' ? 'alert' : 'status'
  const Heading = headingLevel === 3 ? 'h3' : 'h2'

  if (!title) {
    return (
      <div
        role={role}
        className={`flex items-start gap-3 rounded-carte border px-4 py-3 ${style.background} ${style.text}`}
      >
        <Icon name={icon ?? style.icon} className="mt-0.5" />
        <div className="min-w-0 flex-1 text-corps">{children}</div>
      </div>
    )
  }

  return (
    <div role={role} className={`flex items-start gap-4 rounded-carte border p-5 ${style.background}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-champ text-white ${style.badge}`}>
        <Icon name={icon ?? style.icon} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Heading ref={titleRef} tabIndex={-1} className={`font-titre text-intro font-bold ${style.text}`}>
          {title}
        </Heading>
        {children && <div className="text-corps text-encre">{children}</div>}
        {actions && <div className="flex flex-wrap items-center gap-3 pt-2.5">{actions}</div>}
      </div>
    </div>
  )
}

/** Short confirmation, announced to screen readers, to remove after a few seconds. */
export function Confirmation({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-carte border border-succes/35 bg-succes-fond px-4 py-3 font-bold text-succes"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-champ bg-succes text-white">
        <Icon name="check" size={18} />
      </span>
      {children}
    </div>
  )
}
