// Parts shared by the form fields.
import { Icon } from './icons'

export const FIELD_BASE =
  'w-full rounded-champ border bg-surface px-3.5 text-corps text-encre placeholder:text-indicatif transition duration-(--duree-rapide) hover:border-encre-douce'

export const fieldBorder = (error?: string) => (error ? 'border-2 border-erreur' : 'border-trait-fort')

export function FieldFooter({ hintId, hint, error }: { hintId: string; hint?: string; error?: string }) {
  if (error)
    return (
      <span id={hintId} className="flex items-start gap-1.5 text-petit font-bold text-erreur">
        <Icon name="info" size={16} className="mt-0.5" />
        {error}
      </span>
    )
  return hint ? (
    <span id={hintId} className="block text-petit text-aide">
      {hint}
    </span>
  ) : null
}
