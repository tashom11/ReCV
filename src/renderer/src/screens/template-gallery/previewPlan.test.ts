import { CV_TEMPLATES, type TemplateId } from '@core/export/templates'
import { describe, expect, it } from 'vitest'
import { planPreviews } from './previewPlan'

const ids = CV_TEMPLATES.map((t) => t.id)
const cv = { id: 'a' }
const otherCv = { id: 'b' }

describe('planPreviews', () => {
  it('renders the selected template first, then the others', () => {
    const plan = planPreviews(cv, 'modern', new Map())
    expect(plan.first).toEqual(['modern'])
    expect(plan.later).toEqual(ids.filter((id) => id !== 'modern'))
  })

  it('skips the templates already rendered from this CV', () => {
    const renderedFrom = new Map<TemplateId, unknown>(ids.map((id) => [id, cv]))
    renderedFrom.set('classic', otherCv)
    expect(planPreviews(cv, 'modern', renderedFrom)).toEqual({ first: [], later: ['classic'] })
  })

  it('renders nothing when every preview is up to date (template change only)', () => {
    const renderedFrom = new Map<TemplateId, unknown>(ids.map((id) => [id, cv]))
    expect(planPreviews(cv, 'banner', renderedFrom)).toEqual({ first: [], later: [] })
  })
})
