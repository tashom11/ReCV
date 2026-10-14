import { actionLabel, type ErrorAction, type ErrorDescription } from '../errors'
import { texts } from '../i18n'
import { Alert } from './Alert'
import { Button } from './Button'

/**
 * Shows a problem described by `describeError`: title, explanation, actions (the first one is recommended).
 * The technical message stays collapsed in « Détails ».
 */
export function ErrorAlert({
  description,
  onAction,
  labels,
  headingLevel,
}: {
  description: ErrorDescription
  onAction: (action: ErrorAction) => void
  /** Screen-specific labels, when the default ones do not fit. */
  labels?: Partial<Record<ErrorAction, string>>
  headingLevel?: 2 | 3
}) {
  return (
    <Alert
      headingLevel={headingLevel}
      type={description.type}
      icon={description.icon}
      title={description.title}
      actions={
        description.actions.length > 0 &&
        description.actions.map((action, i) => (
          <Button
            key={action}
            size="small"
            variant={i === 0 ? 'primary' : 'secondary'}
            onClick={() => onAction(action)}
          >
            {labels?.[action] ?? actionLabel(action, i === 0)}
          </Button>
        ))
      }
    >
      <p>{description.text}</p>
      {description.details && (
        <details className="pt-1">
          <summary className="inline-flex min-h-11 items-center font-bold text-marque underline underline-offset-4">
            {texts.errorAlert.details}
          </summary>
          <p className="rounded-champ bg-surface/70 p-3 font-mono text-petit break-words text-encre-douce">
            {description.details}
          </p>
        </details>
      )}
    </Alert>
  )
}
