import { describe, expect, it } from 'vitest'
import { goodToKnow } from './goodToKnow'

describe('goodToKnow', () => {
  it('says nothing when the CV meets the requirements', () => {
    expect(goodToKnow({})).toBeNull()
    expect(goodToKnow({ education: { required: 'Bac +2', status: 'ok' } })).toBeNull()
  })

  it('names what the CV does not show, without discouraging', () => {
    expect(
      goodToKnow({
        experience: { required: '2 ans en recrutement', status: 'not-found' },
        education: { required: 'Bac +3', status: 'insufficient', profileValue: 'BTS' },
      }),
    ).toBe(
      'l’annonce souhaite « 2 ans en recrutement ». Cela n’apparaît pas dans votre CV ; l’annonce demande « Bac +3 » (votre CV indique « BTS »), mais cela ne vous empêche pas de postuler.',
    )
  })
})
