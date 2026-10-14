// A professional link is a web address (site, LinkedIn, GitHub, portfolio…). An extraction model sometimes puts
// company names or other words there: only real links are kept.

const LINK_PATTERN = /^(?:https?:\/\/|www\.)\S+$|^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,}(?:\/\S*)?$/iu

export function isProfessionalLink(value: string): boolean {
  return LINK_PATTERN.test(value.trim())
}

export function filterLinks(values: readonly string[]): string[] {
  return values.map((v) => v.trim()).filter(isProfessionalLink)
}
