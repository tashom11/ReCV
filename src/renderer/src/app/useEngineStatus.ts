import { isLocalService } from '@core/serviceUrl'
import { useCallback, useState } from 'react'
import { engineReady } from '../flow'

export interface EngineStatus {
  /** A service is configured, or a local model is present. */
  ready: boolean
  /** The CV leaves this computer (online service, or Ollama on another machine). */
  online: boolean
}

/** Whether the engine can work, and where the CV goes; refreshed on demand (startup, settings changes). */
export function useEngineStatus() {
  const [engine, setEngine] = useState<EngineStatus>({ ready: true, online: false })

  const checkEngine = useCallback(
    (): Promise<EngineStatus> =>
      Promise.all([window.api.getSettings(), window.api.getModelsState()]).then(
        ([settings, models]) => {
          const online =
            settings.provider === 'api' || (settings.provider === 'ollama' && !isLocalService(settings.ollamaUrl))
          const status = { ready: engineReady(settings, models.models), online }
          setEngine(status)
          return status
        },
        () => ({ ready: true, online: false }),
      ),
    [],
  )

  return { engine, checkEngine }
}
