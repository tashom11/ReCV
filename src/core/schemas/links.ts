// Un lien professionnel est une adresse web (site, LinkedIn, GitHub, portfolio…). Un modèle d'extraction y range
// parfois des noms d'entreprises ou d'autres mots : seuls les vrais liens sont conservés.

const LINK_PATTERN = /^(?:https?:\/\/|www\.)\S+$|^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,}(?:\/\S*)?$/iu

export function isProfessionalLink(value: string): boolean {
  return LINK_PATTERN.test(value.trim())
}

export function filterLinks(values: readonly string[]): string[] {
  return values.map((v) => v.trim()).filter(isProfessionalLink)
}
