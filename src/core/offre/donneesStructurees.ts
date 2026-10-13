import { parseHTML } from 'linkedom'
import { htmlVersTexte } from './texte'

export interface OffreStructuree {
  titre: string
  entreprise?: string
  lieu?: string
  description: string
}

type Json = Record<string, unknown>
const estObjet = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function texte(valeur: unknown): string | undefined {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : undefined
}

function trouverJobPosting(noeud: unknown): Json | null {
  if (Array.isArray(noeud)) {
    for (const element of noeud) {
      const trouve = trouverJobPosting(element)
      if (trouve) return trouve
    }
    return null
  }
  if (!estObjet(noeud)) return null
  const type = noeud['@type']
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return noeud
  return trouverJobPosting(noeud['@graph'])
}

function lieuDe(jobLocation: unknown): string | undefined {
  const lieux = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
  const villes = lieux
    .map((l) => (estObjet(l) && estObjet(l.address) ? texte(l.address.addressLocality) : undefined))
    .filter((v): v is string => v !== undefined)
  return villes.length > 0 ? [...new Set(villes)].join(', ') : undefined
}

/**
 * Données structurées `JobPosting` (schema.org) de la page, quand le site les publie (Welcome to the Jungle,
 * beaucoup de jobboards : c'est ce que lit Google for Jobs). Plus fiables et plus propres qu'une extraction de texte.
 */
export function extraireOffreStructuree(html: string): OffreStructuree | null {
  const { document } = parseHTML(html) as unknown as {
    document: { querySelectorAll(s: string): ArrayLike<{ textContent: string | null }> }
  }
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    let donnees: unknown
    try {
      donnees = JSON.parse(script.textContent ?? '')
    } catch {
      continue
    }
    const poste = trouverJobPosting(donnees)
    const titre = texte(poste?.title)
    const description = texte(poste?.description)
    if (!poste || !titre || !description) continue
    const organisation = poste.hiringOrganization
    return {
      titre,
      entreprise: estObjet(organisation) ? texte(organisation.name) : texte(organisation),
      lieu: lieuDe(poste.jobLocation),
      // La description est du HTML (parfois échappé en entités) : on la convertit en texte structuré.
      description: htmlVersTexte(description),
    }
  }
  return null
}
