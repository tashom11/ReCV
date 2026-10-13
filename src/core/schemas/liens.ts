// Un lien professionnel est une adresse web (site, LinkedIn, GitHub, portfolio…). Un modèle d'extraction y range
// parfois des noms d'entreprises ou d'autres mots : seuls les vrais liens sont conservés.

const MOTIF_LIEN = /^(?:https?:\/\/|www\.)\S+$|^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,}(?:\/\S*)?$/iu

export function estLienProfessionnel(valeur: string): boolean {
  return MOTIF_LIEN.test(valeur.trim())
}

export function filtrerLiens(valeurs: readonly string[]): string[] {
  return valeurs.map((v) => v.trim()).filter(estLienProfessionnel)
}
