import { separerCompetences } from '../adaptation/competences'
import type { Profile, TailoredCv } from '../schemas'
import { filterLinks } from '../schemas/links'

// Modèle intermédiaire unique : le PDF (HTML) et le DOCX en sont deux rendus,
// donc même ordre et mêmes titres de section standards (lus par les ATS).

export type Bloc =
  | { type: 'paragraphe'; texte: string }
  | { type: 'liste'; elements: string[] }
  | { type: 'entree'; intitule: string; sousTitre?: string; periode?: string; points: string[] }

export interface Section {
  titre: string
  blocs: Bloc[]
}

export interface CvModele {
  nom: string
  titre: string
  contact: string[]
  /** Photo facultative (data URL), reprise du profil. */
  photo?: string
  sections: Section[]
}

export const TITRES_SECTIONS = {
  profil: 'Profil',
  competences: 'Compétences',
  experience: 'Expérience professionnelle',
  formation: 'Formation',
  langues: 'Langues',
} as const

const nonVide = (valeur: string | undefined): valeur is string => !!valeur?.trim()
const cle = (valeur: string) => valeur.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const joindre = (...parties: (string | undefined)[]) => parties.filter(nonVide).join(', ')

/** Les coordonnées viennent du profil (le CV adapté n'en contient pas). */
export function construireModele(profil: Profile, cv: TailoredCv): CvModele {
  const sections: Section[] = []

  if (nonVide(cv.summary)) {
    sections.push({ titre: TITRES_SECTIONS.profil, blocs: [{ type: 'paragraphe', texte: cv.summary.trim() }] })
  }

  // Compétences en trois lignes étiquetées, lisibles par un humain comme par un ATS :
  // compétences clés (celles de l'offre), savoir-être, outils et techniques.
  const cles = cv.keySkills.filter(nonVide)
  const { savoirEtre, techniques } = separerCompetences(cv.skills.filter(nonVide))
  const lignes = [
    { etiquette: 'Compétences clés', elements: cles },
    { etiquette: 'Savoir-être', elements: savoirEtre },
    { etiquette: 'Outils et techniques', elements: techniques },
  ].filter((l) => l.elements.length > 0)
  if (lignes.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.competences,
      blocs: lignes.map((l) => ({ type: 'paragraphe' as const, texte: `${l.etiquette} : ${l.elements.join(', ')}` })),
    })
  }

  // Un diplôme déjà listé en formation n'est pas une expérience (profil enregistré avant le contrôle d'import).
  const diplomes = new Set(cv.education.map((f) => cle(f.degree)))
  const experiences = cv.experiences.filter((e) => !diplomes.has(cle(e.position)))
  if (experiences.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.experience,
      blocs: experiences.map((e) => ({
        type: 'entree' as const,
        intitule: e.position,
        sousTitre: joindre(e.company, e.location),
        periode: e.dateRange,
        points: e.bullets.filter(nonVide),
      })),
    })
  }

  if (cv.education.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.formation,
      blocs: cv.education.map((f) => ({
        type: 'entree' as const,
        intitule: f.degree,
        sousTitre: joindre(f.school, f.location),
        periode: f.dateRange,
        points: nonVide(f.description) ? [f.description.trim()] : [],
      })),
    })
  }

  if (cv.languages.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.langues,
      blocs: [
        {
          type: 'paragraphe',
          texte: cv.languages.map((l) => (nonVide(l.level) ? `${l.name} (${l.level})` : l.name)).join(', '),
        },
      ],
    })
  }

  return {
    nom: profil.fullName?.trim() ?? '',
    titre: cv.headline.trim(),
    contact: [profil.email, profil.phone, profil.location, ...filterLinks(profil.links)].filter(nonVide),
    photo: profil.photo,
    sections,
  }
}

/** Nom de fichier sûr (Windows), ex. « CV-Claire-Dubois.pdf ». */
export function nomFichierCv(modele: CvModele, extension: 'pdf' | 'docx'): string {
  const base = modele.nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `CV${base ? `-${base}` : ''}.${extension}`
}
