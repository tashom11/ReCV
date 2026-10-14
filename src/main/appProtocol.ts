import { join, relative, resolve, sep } from 'node:path'

// The interface is served from `app://recv/` rather than `file://`: a local file opened by mistake in the window
// (link, dropped HTML file) then has neither the same origin nor access to the IPC.
export const APP_SCHEME = 'app'
export const APP_HOST = 'recv'
export const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** True for a page of the application: `app://recv/…`, or the dev server origin when one is given. */
export function isAppUrl(url: string, devServerUrl?: string): boolean {
  const parsed = parse(url)
  if (!parsed) return false
  if (devServerUrl) {
    const dev = parse(devServerUrl)
    if (dev && parsed.origin === dev.origin) return true
  }
  return parsed.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST
}

/** File of `rootDir` served for an `app://recv/…` request, or `null` if the request leaves that folder. */
export function resolveAppFile(requestUrl: string, rootDir: string): string | null {
  const parsed = parse(requestUrl)
  if (!parsed || parsed.protocol !== `${APP_SCHEME}:` || parsed.host !== APP_HOST) return null
  let pathname: string
  try {
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  const root = resolve(rootDir)
  const file = resolve(join(root, pathname === '/' ? 'index.html' : pathname))
  const inside = relative(root, file)
  return inside !== '' && !inside.startsWith('..') && !inside.startsWith(sep) && !/^[a-z]:/i.test(inside) ? file : null
}
