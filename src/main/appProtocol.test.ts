import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAppUrl, resolveAppFile } from './appProtocol'

const ROOT = join('C:', 'app', 'out', 'renderer')

describe('isAppUrl', () => {
  it('accepts the application pages only', () => {
    expect(isAppUrl('app://recv/index.html')).toBe(true)
    expect(isAppUrl('app://recv/')).toBe(true)
  })

  it('rejects any local file, other host or other scheme', () => {
    expect(isAppUrl('file:///C:/app/out/renderer/index.html')).toBe(false)
    expect(isAppUrl('file:///C:/Users/me/Downloads/page.html')).toBe(false)
    expect(isAppUrl('app://other/index.html')).toBe(false)
    expect(isAppUrl('https://recv/index.html')).toBe(false)
    expect(isAppUrl('')).toBe(false)
  })

  it('accepts the dev server origin only when one is given', () => {
    expect(isAppUrl('http://localhost:5173/', 'http://localhost:5173')).toBe(true)
    expect(isAppUrl('http://localhost:5174/', 'http://localhost:5173')).toBe(false)
    expect(isAppUrl('http://localhost:5173/')).toBe(false)
  })
})

describe('resolveAppFile', () => {
  it('maps a request to a file of the renderer folder', () => {
    expect(resolveAppFile('app://recv/index.html', ROOT)).toBe(join(ROOT, 'index.html'))
    expect(resolveAppFile('app://recv/assets/logo-x.png', ROOT)).toBe(join(ROOT, 'assets', 'logo-x.png'))
  })

  it('serves index.html for the root', () => {
    expect(resolveAppFile('app://recv/', ROOT)).toBe(join(ROOT, 'index.html'))
  })

  it('never resolves to a file outside the renderer folder', () => {
    expect(resolveAppFile('app://recv/..%2F..%2Fsecret.txt', ROOT)).toBeNull()
    expect(resolveAppFile('app://recv/..%5C..%5Csecret.txt', ROOT)).toBeNull()
    expect(resolveAppFile('app://recv/x/..%2F..%2F..%2Fsecret.txt', ROOT)).toBeNull()
    // Plain dot segments are already removed by the URL parser: the request stays in the folder.
    expect(resolveAppFile('app://recv/%2e%2e/%2e%2e/secret.txt', ROOT)).toBe(join(ROOT, 'secret.txt'))
  })

  it('refuses another host', () => {
    expect(resolveAppFile('app://other/index.html', ROOT)).toBeNull()
  })
})
