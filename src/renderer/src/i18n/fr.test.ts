import { TEMPLATE_IDS } from '@core/export/templates'
import { describe, expect, it } from 'vitest'
import { texts } from '.'

describe('texts', () => {
  it('names every CV layout', () => {
    for (const id of TEMPLATE_IDS) expect(texts.templates[id]).not.toBe('')
  })
})
