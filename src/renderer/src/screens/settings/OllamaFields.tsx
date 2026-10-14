import type { Settings } from '@core/api'
import { isLocalService } from '@core/serviceUrl'
import { texts } from '../../i18n'
import { Alert, TextField } from '../../ui'

/** Ollama address and model; warns when the address is not this computer (the CV then leaves it). */
export function OllamaFields({
  settings,
  update,
}: {
  settings: Settings
  update: (partial: Partial<Settings>) => void
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={texts.settings.ollama.url}
          value={settings.ollamaUrl}
          onChange={(v) => update({ ollamaUrl: v })}
        />
        <TextField
          label={texts.settings.ollama.model}
          value={settings.ollamaModel}
          onChange={(v) => update({ ollamaModel: v })}
        />
      </div>
      {!isLocalService(settings.ollamaUrl) && (
        <Alert type="warning">
          <strong>{texts.settings.ollama.remote}</strong> {texts.settings.ollama.remoteText}
          {settings.ollamaUrl.startsWith('http:') ? texts.settings.ollama.unencrypted : ''}
          {texts.settings.ollama.end}
        </Alert>
      )}
    </>
  )
}
