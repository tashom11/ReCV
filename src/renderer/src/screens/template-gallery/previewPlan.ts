import { CV_TEMPLATES, type TemplateId } from '@core/export/templates'

/**
 * Previews to recompute: the selected template first (it is the large preview), the thumbnails later. A preview
 * already rendered from this very CV is kept as is.
 */
export function planPreviews(
  cv: unknown,
  selected: TemplateId,
  renderedFrom: ReadonlyMap<TemplateId, unknown>,
): { first: TemplateId[]; later: TemplateId[] } {
  const stale = CV_TEMPLATES.map((t) => t.id).filter((id) => renderedFrom.get(id) !== cv)
  return {
    first: stale.filter((id) => id === selected),
    later: stale.filter((id) => id !== selected),
  }
}
