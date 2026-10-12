import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { retirerNulls, versSchemaGrammaire } from './moteurLocal'

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
