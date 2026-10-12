import type { ApiReCV } from '@core/api'

declare global {
  interface Window {
    api: ApiReCV
  }
}
