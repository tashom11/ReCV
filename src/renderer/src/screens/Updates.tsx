import type { UpdateState } from '@core/api'
import { useEffect, useState } from 'react'
import { texts } from '../i18n'
import { Button, Card, Icon, type IconName, Spinner } from '../ui'

/** Update state, followed live (initial read, then changes sent by the application). */
export function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    window.api.getUpdateState().then(setState, () => undefined)
    return window.api.onUpdate(setState)
  }, [])
  return state
}

const time = (atMs: number) => new Date(atMs).toLocaleTimeString(texts.locale, { hour: '2-digit', minute: '2-digit' })

function describe(state: UpdateState): { icon: IconName | null; tone: string; text: string } {
  switch (state.status) {
    case 'up-to-date':
      return {
        icon: 'check-circle',
        tone: 'text-marque',
        text: state.checkedAt ? texts.updates.upToDateAt(time(state.checkedAt)) : texts.updates.upToDate,
      }
    case 'checking':
      return { icon: null, tone: 'text-encre', text: texts.updates.checking }
    case 'downloading':
      return {
        icon: null,
        tone: 'text-encre',
        text: texts.updates.downloading(state.newVersion ?? texts.updates.nextVersion, state.percent ?? 0),
      }
    case 'ready':
      return {
        icon: 'download',
        tone: 'text-marque',
        text: texts.updates.ready(state.newVersion ?? texts.updates.nextVersion),
      }
    case 'error':
      return {
        icon: 'warning',
        tone: 'text-alerte',
        text: texts.updates.error,
      }
    case 'unavailable':
      return {
        icon: 'info',
        tone: 'text-encre-douce',
        text: texts.updates.unavailable,
      }
    default:
      return { icon: 'info', tone: 'text-encre-douce', text: texts.updates.none }
  }
}

/** Settings: installed version, update state, check on demand and restart. */
export function UpdatesCard() {
  const state = useUpdateState()
  const [requested, setRequested] = useState(false)
  if (!state) return null

  const { icon, tone, text } = describe(state)
  const busyWith = requested || state.status === 'checking' || state.status === 'downloading'

  const check = () => {
    setRequested(true)
    window.api
      .checkForUpdate()
      .catch(() => undefined)
      .finally(() => setRequested(false))
  }

  return (
    <Card title={texts.updates.title} subtitle={texts.updates.installedVersion(state.version)}>
      <p role="status" aria-live="polite" className={`flex items-start gap-2.5 text-corps font-bold ${tone}`}>
        {icon ? <Icon name={icon} className="mt-0.5" /> : <Spinner size={20} />}
        {text}
      </p>
      {state.status === 'downloading' && (
        <div
          role="progressbar"
          aria-label={texts.updates.progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.percent ?? 0}
          className="h-2.5 overflow-hidden rounded-full bg-creux"
        >
          <div className="h-full rounded-full bg-marque transition-all" style={{ width: `${state.percent ?? 0}%` }} />
        </div>
      )}
      {state.status === 'error' && state.message && (
        <details>
          <summary className="inline-flex min-h-11 items-center font-bold text-marque underline underline-offset-4">
            {texts.common.details}
          </summary>
          <p className="rounded-champ bg-papier p-3 font-mono text-petit break-words text-encre-douce">
            {state.message}
          </p>
        </details>
      )}
      {state.status === 'ready' ? (
        <Button icon="restart" onClick={() => void window.api.installUpdate().catch(() => undefined)}>
          {texts.updates.restart}
        </Button>
      ) : (
        state.status !== 'unavailable' && (
          <Button variant="secondary" icon="restart" onClick={check} busy={busyWith}>
            {texts.updates.check}
          </Button>
        )
      )}
    </Card>
  )
}
