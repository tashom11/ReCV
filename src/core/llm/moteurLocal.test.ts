import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { retirerNulls, texteReponse, versSchemaGrammaire } from './moteurLocal'

// Fonctions pures uniquement : aucun modèle n'est chargé.
describe('versSchemaGrammaire', () => {
  it('rend nullables les propriétés optionnelles et retire $schema/default', () => {
    const schema = z.object({ titre: z.string(), lieu: z.string().optional(), points: z.array(z.string()).default([]) })
    const resultat = versSchemaGrammaire(schema) as unknown as Record<string, unknown>
    expect(JSON.stringify(resultat)).not.toMatch(/"\$schema"|"default"/)
    expect(resultat.required).toBeUndefined()
    expect(resultat.properties).toEqual({
      titre: { type: 'string' },
      lieu: { oneOf: [{ type: 'string' }, { type: 'null' }] },
      points: { type: 'array', items: { type: 'string' } },
    })
  })
})

describe('retirerNulls', () => {
  it('supprime les clés nulles en profondeur', () => {
    expect(retirerNulls({ a: null, b: [{ c: null, d: 1 }] })).toEqual({ b: [{ d: 1 }] })
  })
})

describe('texteReponse', () => {
  it('recolle texte simple et segments de pensée (réponse « à réflexion » vide dans responseText)', () => {
    expect(texteReponse([{ type: 'segment', segmentType: 'thought', text: '{"a":1}' }])).toBe('{"a":1}')
    expect(texteReponse(['{"a":', { type: 'segment', text: '1}' }])).toBe('{"a":1}')
  })

  it('ignore les parties sans texte (appels de fonction)', () => {
    expect(texteReponse([{ type: 'functionCall', name: 'x' }, '{}'])).toBe('{}')
  })
})
