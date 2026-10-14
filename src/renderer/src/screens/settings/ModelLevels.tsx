import type { LocalModelState, ModelDownloadProgress, ModelsState } from '@core/api'
import type { ModelLevel } from '@core/llm/localModels'
import { useCallback, useEffect, useState } from 'react'
import { downloadAnnouncement } from '../../accessibility'
import { describeError, type ErrorDescription } from '../../errors'
import { formatSize } from '../../estimate'
import { Button, ErrorAlert } from '../../ui'

// The three local models, named by what they change for the user.
const LEVEL_LABELS: Record<ModelLevel, { name: string; detail: string }> = {
  fast: { name: 'Rapide', detail: 'Pour les ordinateurs modestes' },
  balanced: { name: 'Équilibré', detail: 'Bon résultat sur la plupart des ordinateurs' },
  quality: { name: 'Soigné', detail: 'Meilleur résultat' },
}

/** Choice and installation of the model running on the computer: Rapide, Équilibré or Soigné. */
export function ModelLevels({
  activePath,
  onActive,
  onState,
}: {
  activePath: string | undefined
  /** An installed model is chosen, or has just been installed. */
  onActive: (path: string | undefined) => void
  onState: (state: ModelsState) => void
}) {
  const [state, setState] = useState<ModelsState | null>(null)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [busyWith, setBusyWith] = useState<string | null>(null)

  const refresh = useCallback(
    () =>
      window.api.getModelsState().then(
        (e) => {
          setState(e)
          setProgress(e.download)
          onState(e)
          return e
        },
        () => null,
      ),
    [onState],
  )

  useEffect(() => {
    void refresh()
    return window.api.onModelProgress((p) => {
      setProgress(p)
      if (p.status === 'done') {
        // The main process has selected the installed model: this choice is taken over.
        void refresh().then((e) => onActive(e?.models.find((m) => m.id === p.id)?.path))
      }
      if (p.status === 'cancelled' || p.status === 'error') void refresh()
    })
  }, [refresh, onActive])

  const busy = progress?.status === 'downloading' || progress?.status === 'verifying'

  const install = async (id: string) => {
    setError(null)
    setBusyWith(id)
    try {
      await window.api.downloadModel(id)
    } catch (e) {
      setError(describeError('setup', e))
    } finally {
      setBusyWith(null)
    }
  }

  const remove = async (m: LocalModelState) => {
    setError(null)
    setBusyWith(m.id)
    try {
      await window.api.deleteModel(m.id)
      const after = await refresh()
      if (activePath === m.path) onActive(after?.models.find((x) => x.installed)?.path)
    } catch (e) {
      setError(describeError('settings', e))
    } finally {
      setBusyWith(null)
    }
  }

  if (!state) return null

  return (
    <fieldset className="space-y-2.5">
      <legend className="pb-2 text-corps font-bold text-encre">Rapidité ou soin du résultat</legend>
      {error && (
        <ErrorAlert
          description={error}
          onAction={() => setError(null)}
          labels={{ dismiss: 'Compris' }}
          headingLevel={3}
        />
      )}
      {state.models.map((m) => {
        const level = LEVEL_LABELS[m.level]
        const active = m.installed && activePath === m.path
        const download = progress?.id === m.id && busy ? progress : null
        const percent =
          download && download.totalBytes > 0 ? Math.round((download.receivedBytes / download.totalBytes) * 100) : 0
        const slowNote = m.compatible ? '' : ', mais lent sur votre ordinateur'
        return (
          <div
            key={m.id}
            className={`space-y-3 rounded-carte bg-surface p-4 ${active ? 'border-2 border-marque' : 'border border-trait p-[17px]'}`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex min-h-11 min-w-0 flex-1 items-start gap-3.5">
                <input
                  type="radio"
                  name="niveau-modele"
                  className="mt-1 size-5 shrink-0"
                  checked={active}
                  disabled={!m.installed}
                  onChange={() => onActive(m.path)}
                />
                <span className="min-w-0">
                  <span className="block text-corps text-encre">
                    <strong>{level.name}</strong>
                    {m.recommended && <span className="text-marque"> · conseillé pour votre ordinateur</span>}
                  </span>
                  <span className="block text-petit text-aide">
                    {m.installed
                      ? `Installé · ${formatSize(m.sizeBytes)}`
                      : `${level.detail}${slowNote} · ${formatSize(m.sizeBytes)} à télécharger`}
                  </span>
                </span>
              </label>
              {m.installed ? (
                <Button
                  variant="danger"
                  size="small"
                  disabled={busy || busyWith !== null}
                  busy={busyWith === m.id}
                  onClick={() => void remove(m)}
                >
                  Supprimer
                </Button>
              ) : download ? (
                <Button variant="secondary" size="small" onClick={() => void window.api.cancelDownload()}>
                  Mettre en pause
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="small"
                  disabled={busy || busyWith !== null}
                  busy={busyWith === m.id}
                  onClick={() => void install(m.id)}
                >
                  Installer
                </Button>
              )}
            </div>
            {download && (
              <div className="space-y-1.5">
                <div
                  role="progressbar"
                  aria-label={`Téléchargement du niveau ${level.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={download.status === 'verifying' ? undefined : percent}
                  className="h-2.5 overflow-hidden rounded-full bg-creux"
                >
                  {download.status === 'verifying' ? (
                    <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
                  ) : (
                    <div className="h-full rounded-full bg-marque transition-all" style={{ width: `${percent}%` }} />
                  )}
                </div>
                <p className="text-petit text-aide">
                  {download.status === 'verifying'
                    ? 'Vérification du fichier… quelques secondes'
                    : `${formatSize(download.receivedBytes)} sur ${formatSize(download.totalBytes)} (${percent} %)`}
                </p>
                <p className="sr-only" role="status">
                  {downloadAnnouncement(percent, download.status === 'verifying')}
                </p>
              </div>
            )}
            {progress?.id === m.id && progress.status === 'cancelled' && (
              <p className="text-petit text-aide">En pause : le téléchargement reprendra là où il s’était arrêté.</p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
