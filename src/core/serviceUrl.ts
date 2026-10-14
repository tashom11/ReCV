// Dependency-free (no zod): also imported by the renderer.

export const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '[::1]'])

/** http(s) URL without credentials, or `null`. */
export function analyserUrl(valeur: string): URL | null {
  try {
    const url = new URL(valeur)
    const http = url.protocol === 'http:' || url.protocol === 'https:'
    return http && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

/** True when the service runs on this computer: the CV sent to it does not leave the machine. */
export function estServiceLocal(valeur: string): boolean {
  const url = analyserUrl(valeur)
  return url !== null && HOTES_LOCAUX.has(url.hostname)
}
