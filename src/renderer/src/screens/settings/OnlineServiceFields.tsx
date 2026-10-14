import type { SettingsState } from '@core/api'
import { useState } from 'react'
import { texts } from '../../i18n'
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
        <strong>{texts.settings.online.warning}</strong> {texts.settings.online.warningText}
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={texts.settings.online.service}
          value={otherService ? OTHER_SERVICE : settings.apiUrl}
          options={[...SERVICES, { value: OTHER_SERVICE, label: texts.settings.online.otherService }]}
          onChange={(v) => {
            setOtherService(v === OTHER_SERVICE)
            if (v !== OTHER_SERVICE) update({ apiUrl: v })
          }}
        />
        <TextField
          label={texts.settings.online.key}
          type="password"
          value={apiKey}
          onChange={onApiKey}
          placeholder={settings.hasApiKey ? texts.settings.online.keySaved : ''}
        />
        {otherService && (
          <TextField
            label={texts.settings.online.url}
            value={settings.apiUrl}
            onChange={(v) => update({ apiUrl: v })}
            hint={texts.settings.online.urlHint}
          />
        )}
        <TextField
          label={texts.settings.online.model}
          value={settings.apiModel}
          onChange={(v) => update({ apiModel: v })}
          hint={texts.settings.online.modelHint}
        />
      </div>
      <p className="text-petit text-aide">
        {settings.hasApiKey ? texts.settings.online.hasKey : texts.settings.online.noKey}
      </p>
      {settings.hasApiKey && (
        <Button variant="danger" size="small" onClick={onRemoveKey} busy={removingKey} disabled={disabled}>
          {texts.settings.online.removeKey}
        </Button>
      )}
    </>
  )
}
