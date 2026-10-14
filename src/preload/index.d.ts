import type { RecvApi } from '@core/api'

declare global {
  interface Window {
    api: RecvApi
  }
}
