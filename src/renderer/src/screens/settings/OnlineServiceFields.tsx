import type { SettingsState } from '@core/api'
import { useState } from 'react'
import { Alert, Button, Select, TextField } from '../../ui'

export const SERVICES = [
  { value: 'https://api.openai.com/v1', label: 'OpenAI' },
  { value: 'https://api.mistral.ai/v1', label: 'Mistral' },
  { value: 'https://openrouter.ai/api/v1', label: 'OpenRouter' },
]
const OTHER_SERVICE = 'other'

/**
 * Online service with the user's own key: privacy warning first, then service, key and model. The key is never shown
 * again once saved; it can only be replaced or removed.
 */
export function OnlineServiceFields({
  settings,
  update,
  apiKey,
  onApiKey,
  onRemoveKey,
  removingKey,
  disabled,
}: {
  settings: SettingsState
  update: (partial: Partial<SettingsState>) => void
  /** Key being typed (not saved yet). */
  apiKey: string
  onApiKey: (key: string) => void
  onRemoveKey: () => void
  removingKey: boolean
  disabled: boolean
}) {
  const [otherService, setOtherService] = useState(() => !SERVICES.some((s) => s.value === settings.apiUrl))
  return (
    <>
      <Alert type="warning">
        <strong>Votre CV et l’annonce seront envoyés à ce service.</strong> Ils quittent votre ordinateur à chaque
        création de CV.
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Service"
          value={otherService ? OTHER_SERVICE : settings.apiUrl}
          options={[...SERVICES, { value: OTHER_SERVICE, label: 'Autre adresse' }]}
          onChange={(v) => {
            setOtherService(v === OTHER_SERVICE)
            if (v !== OTHER_SERVICE) update({ apiUrl: v })
          }}
        />
        <TextField
          label="Clé personnelle (API)"
          type="password"
          value={apiKey}
          onChange={onApiKey}
          placeholder={settings.hasApiKey ? '•••••••••••• (enregistrée)' : ''}
        />
        {otherService && (
          <TextField
            label="Adresse du service"
            value={settings.apiUrl}
            onChange={(v) => update({ apiUrl: v })}
            hint="Elle commence par https:// et finit souvent par /v1."
          />
        )}
        <TextField
          label="Modèle"
          value={settings.apiModel}
          onChange={(v) => update({ apiModel: v })}
          hint="Le nom donné par le service, par exemple « mistral-small-latest »."
        />
      </div>
      <p className="text-petit text-aide">
        {settings.hasApiKey
          ? 'Une clé est enregistrée, chiffrée sur votre ordinateur. Elle n’est jamais réaffichée.'
          : 'Aucune clé enregistrée pour l’instant.'}
      </p>
      {settings.hasApiKey && (
        <Button variant="danger" size="small" onClick={onRemoveKey} busy={removingKey} disabled={disabled}>
          Supprimer la clé
        </Button>
      )}
    </>
  )
}
