import type { ApiReCV } from './index'

declare global {
  interface Window {
    api: ApiReCV
  }
}
