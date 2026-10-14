import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { removeNulls, responseText, toGrammarSchema } from './localEngine'

// Pure functions only: no model is loaded.
describe('toGrammarSchema', () => {
  it('makes optional properties nullable and removes $schema/default', () => {
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

describe('removeNulls', () => {
  it('removes null keys deeply', () => {
    expect(removeNulls({ a: null, b: [{ c: null, d: 1 }] })).toEqual({ b: [{ d: 1 }] })
  })
})

describe('responseText', () => {
  it('joins plain text and thought segments back (empty « thinking » answer in responseText)', () => {
    expect(responseText([{ type: 'segment', segmentType: 'thought', text: '{"a":1}' }])).toBe('{"a":1}')
    expect(responseText(['{"a":', { type: 'segment', text: '1}' }])).toBe('{"a":1}')
  })

  it('ignores parts without text (function calls)', () => {
    expect(responseText([{ type: 'functionCall', name: 'x' }, '{}'])).toBe('{}')
  })
})
