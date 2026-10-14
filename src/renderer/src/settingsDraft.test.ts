import type { Parametres } from '@core/api'
import { describe, expect, it } from 'vitest'
import { hasUnsavedTextChanges } from './settingsDraft'

const saved: Parametres = {
  fournisseur: 'local',
  modeleOllama: 'qwen3:8b',
  urlOllama: 'http://localhost:11434/v1',
  urlApi: 'https://api.openai.com/v1',
  modeleApi: '',
  reformulerPuces: false,
  modeleCv: 'classique',
  cheminModeleLocal: 'C:\\m.gguf',
}

describe('hasUnsavedTextChanges', () => {
  it('is false when the draft matches what is saved', () => {
    expect(hasUnsavedTextChanges(saved, { ...saved }, '')).toBe(false)
  })

  it('is true when a text field was edited', () => {
    expect(hasUnsavedTextChanges(saved, { ...saved, modeleApi: 'mistral-small-latest' }, '')).toBe(true)
    expect(hasUnsavedTextChanges(saved, { ...saved, urlOllama: 'http://localhost:11435/v1' }, '')).toBe(true)
    expect(hasUnsavedTextChanges(saved, { ...saved, cheminModeleLocal: 'C:\\autre.gguf' }, '')).toBe(true)
  })

  it('is true when an API key was typed', () => {
    expect(hasUnsavedTextChanges(saved, saved, 'sk-123')).toBe(true)
    expect(hasUnsavedTextChanges(saved, saved, '   ')).toBe(false)
  })

  it('ignores the choices that are saved immediately', () => {
    const draft: Parametres = { ...saved, fournisseur: 'api', reformulerPuces: true, modeleCv: 'moderne' }
    expect(hasUnsavedTextChanges(saved, draft, '')).toBe(false)
  })
})
