import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { removeNulls, responseText, toGrammarSchema } from './localEngine'

// Fonctions pures uniquement : aucun modèle n'est chargé.
describe('versSchemaGrammaire', () => {
  it('rend nullables les propriétés optionnelles et retire $schema/default', () => {
    const schema = z.object({
      title: z.string(),
      location: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    })
    const result = toGrammarSchema(schema) as unknown as Record<string, unknown>
    expect(JSON.stringify(result)).not.toMatch(/"\$schema"|"default"/)
    expect(result.required).toBeUndefined()
    expect(result.properties).toEqual({
      title: { type: 'string' },
      location: { oneOf: [{ type: 'string' }, { type: 'null' }] },
      bullets: { type: 'array', items: { type: 'string' } },
    })
  })
})

describe('retirerNulls', () => {
  it('supprime les clés nulles en profondeur', () => {
    expect(removeNulls({ a: null, b: [{ c: null, d: 1 }] })).toEqual({ b: [{ d: 1 }] })
  })
})

describe('texteReponse', () => {
  it('recolle texte simple et segments de pensée (réponse « à réflexion » vide dans responseText)', () => {
    expect(responseText([{ type: 'segment', segmentType: 'thought', text: '{"a":1}' }])).toBe('{"a":1}')
    expect(responseText(['{"a":', { type: 'segment', text: '1}' }])).toBe('{"a":1}')
  })

  it('ignore les parties sans texte (appels de fonction)', () => {
    expect(responseText([{ type: 'functionCall', name: 'x' }, '{}'])).toBe('{}')
  })
})
