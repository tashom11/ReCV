import type { Settings } from '@core/api'
import { describe, expect, it } from 'vitest'
import { hasUnsavedTextChanges } from './settingsDraft'

const saved: Settings = {
  provider: 'local',
  ollamaModel: 'qwen3:8b',
  ollamaUrl: 'http://localhost:11434/v1',
  apiUrl: 'https://api.openai.com/v1',
  apiModel: '',
  rewriteBullets: false,
  cvTemplate: 'classic',
  localModelPath: 'C:\\m.gguf',
}

describe('hasUnsavedTextChanges', () => {
  it('is false when the draft matches what is saved', () => {
    expect(hasUnsavedTextChanges(saved, { ...saved }, '')).toBe(false)
  })

  it('is true when a text field was edited', () => {
    expect(hasUnsavedTextChanges(saved, { ...saved, apiModel: 'mistral-small-latest' }, '')).toBe(true)
    expect(hasUnsavedTextChanges(saved, { ...saved, ollamaUrl: 'http://localhost:11435/v1' }, '')).toBe(true)
  })

  it('ignores the model file, chosen with the picker and saved at once', () => {
    expect(hasUnsavedTextChanges(saved, { ...saved, localModelPath: 'C:\\autre.gguf' }, '')).toBe(false)
  })

  it('is true when an API key was typed', () => {
    expect(hasUnsavedTextChanges(saved, saved, 'sk-123')).toBe(true)
    expect(hasUnsavedTextChanges(saved, saved, '   ')).toBe(false)
  })

  it('ignores the choices that are saved immediately', () => {
    const draft: Settings = { ...saved, provider: 'api', rewriteBullets: true, cvTemplate: 'modern' }
    expect(hasUnsavedTextChanges(saved, draft, '')).toBe(false)
  })
})
