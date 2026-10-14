// Dependency-free (no zod): also imported by the renderer.

export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** http(s) URL without credentials, or `null`. */
export function parseServiceUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    const http = url.protocol === 'http:' || url.protocol === 'https:'
    return http && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

/** True when the service runs on this computer: the CV sent to it does not leave the machine. */
export function isLocalService(value: string): boolean {
  const url = parseServiceUrl(value)
  return url !== null && LOCAL_HOSTS.has(url.hostname)
}
