import type { LocalModelState, ModelDownloadProgress } from '@core/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadAnnouncement } from '../accessibility'
import { describeError, type ErrorDescription } from '../errors'
import { formatSize, rate, remainingDownload } from '../estimate'
import { texts } from '../i18n'
import { Button, ErrorAlert, Icon, LinkButton } from '../ui'

/**
 * First launch setup: the file Re:CV needs to work without internet is downloaded once. The details (which model, which
 * alternatives) stay in the Settings.
 */
export function SetupScreen({
  onReady,
  onLater,
  onSettings,
}: {
  onReady: () => void
  onLater: () => void
  onSettings: () => void
}) {
  const [model, setModel] = useState<LocalModelState | null>(null)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [remaining, setRemaining] = useState<string | null>(null)
  // First reading of the session: the rate is measured from there (a resumed download does not start from zero bytes).
  const origin = useRef<{ bytes: number; atMs: number } | null>(null)
  const started = useRef(false)

  const download = useCallback(async (id: string) => {
    setError(null)
    origin.current = null
    try {
      await window.api.downloadModel(id)
    } catch (e) {
      // Already running (started from the Settings): simply follow its progress.
      const state = await window.api.getModelsState().catch(() => null)
      if (!state?.download) setError(describeError('setup', e))
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onModelProgress((p) => {
      setProgress(p)
      if (p.status === 'downloading') {
        const reading = { bytes: p.receivedBytes, atMs: Date.now() }
        origin.current ??= reading
        setRemaining(remainingDownload(p.receivedBytes, p.totalBytes, rate(origin.current, reading)))
      }
      if (p.status === 'done') onReady()
    })
    if (!started.current) {
      started.current = true
      window.api.getModelsState().then(
        (state) => {
          const chosen = state.models.find((m) => m.recommended) ?? state.models[0]
          if (!chosen) return
          setModel(chosen)
          if (state.models.some((m) => m.installed)) onReady()
          else if (state.download) setProgress(state.download)
          else void download(chosen.id)
        },
        (e) => setError(describeError('setup', e)),
      )
    }
    return unsubscribe
  }, [onReady, download])

  const total = progress?.totalBytes || model?.sizeBytes || 0
  const received = progress?.receivedBytes ?? 0
  const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0
  const verifying = progress?.status === 'verifying'
  const interrupted = progress?.status === 'error' && !error

  return (
    <div className="mx-auto w-full max-w-3xl px-6 sm:px-10 lg:px-16 py-14 sm:py-20">
      <section className="space-y-7 rounded-panneau border border-trait bg-surface p-10 shadow-panneau">
        <header className="flex items-center gap-5">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-carte border border-accent bg-accent-pale text-encre"
            aria-hidden="true"
          >
            <Icon name="download" size={28} />
          </span>
          <h1 className="font-titre text-titre-ecran font-bold">{texts.setup.title}</h1>
        </header>
        <p className="text-intro text-encre-douce">
          {texts.setup.intro.start}
          {model ? (
            <>
              {' '}
              {texts.setup.intro.sizePrefix} <strong className="text-encre">{formatSize(model.sizeBytes)}</strong>
            </>
          ) : (
            texts.setup.intro.unknownSize
          )}
          {texts.setup.intro.onceBefore}
          <strong className="text-encre">{texts.setup.intro.once}</strong>
          {texts.setup.intro.onceAfter}
        </p>

        {error || interrupted ? (
          <ErrorAlert
            description={error ?? describeError('setup', progress?.message ?? texts.setup.interrupted)}
            onAction={() => model && void download(model.id)}
          />
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[1.5rem] font-bold tabular-nums" aria-hidden="true">
                {percent} %
              </span>
              {/* Visible text changes several times per second: only the sr-only line below is announced. */}
              <span className="text-corps text-encre-douce">
                {verifying
                  ? texts.setup.verifying
                  : total > 0
                    ? `${texts.setup.progress(formatSize(received), formatSize(total))}${remaining ? ` · ${remaining}` : ''}`
                    : texts.setup.starting}
              </span>
            </div>
            <p className="sr-only" role="status">
              {total > 0 ? downloadAnnouncement(percent, verifying) : ''}
            </p>
            <div
              role="progressbar"
              aria-label={texts.setup.progressLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={verifying ? undefined : percent}
              className="h-3.5 overflow-hidden rounded-full bg-creux"
            >
              {verifying ? (
                <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
              ) : (
                <div
                  className="h-full rounded-full bg-marque transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              )}
            </div>
          </div>
        )}

        <ul className="space-y-3 rounded-carte bg-papier p-6 text-corps text-encre">
          {texts.setup.tips.map((line) => (
            <li key={line} className="flex items-start gap-3.5">
              <Icon name="check" size={18} strokeWidth={2.5} className="mt-1 text-marque" />
              {line}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => {
              void window.api.cancelDownload()
              onLater()
            }}
          >
            {texts.setup.later}
          </Button>
          <LinkButton onClick={onSettings}>{texts.setup.otherOption}</LinkButton>
        </div>
      </section>
    </div>
  )
}
