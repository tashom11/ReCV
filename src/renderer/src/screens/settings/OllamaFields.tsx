import type { Settings } from '@core/api'
import { isLocalService } from '@core/serviceUrl'
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
        <TextField label="Adresse d’Ollama" value={settings.ollamaUrl} onChange={(v) => update({ ollamaUrl: v })} />
        <TextField label="Modèle" value={settings.ollamaModel} onChange={(v) => update({ ollamaModel: v })} />
      </div>
      {!isLocalService(settings.ollamaUrl) && (
        <Alert type="warning">
          <strong>Cette adresse n’est pas celle de votre ordinateur.</strong> Votre CV et l’annonce seront envoyés à cet
          appareil
          {settings.ollamaUrl.startsWith('http:') ? ', sans chiffrement sur le réseau' : ''}.
        </Alert>
      )}
    </>
  )
}
