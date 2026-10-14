import type { Profile, TailoredCv } from '../schemas'
import { filterLinks } from '../schemas/links'
import { splitSoftAndHardSkills } from '../tailoring/skills'

// Modèle intermédiaire unique : le PDF (HTML) et le DOCX en sont deux rendus,
// donc même ordre et mêmes titres de section standards (lus par les ATS).

export type Block =
  | { type: 'paragraphe'; text: string }
  | { type: 'liste'; elements: string[] }
  | { type: 'entree'; heading: string; subtitle?: string; dateRange?: string; bullets: string[] }

export interface Section {
  title: string
  blocks: Block[]
}

export interface CvDocument {
  name: string
  title: string
  contact: string[]
  /** Photo facultative (data URL), reprise du profil. */
  photo?: string
  sections: Section[]
}

export const SECTION_TITLES = {
  profile: 'Profil',
  skills: 'Compétences',
  experience: 'Expérience professionnelle',
  education: 'Formation',
  languages: 'Langues',
} as const

const isNotEmpty = (value: string | undefined): value is string => !!value?.trim()
const key = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const joinNonEmpty = (...parts: (string | undefined)[]) => parts.filter(isNotEmpty).join(', ')

/** Les coordonnées viennent du profil (le CV adapté n'en contient pas). */
export function buildCvDocument(profile: Profile, cv: TailoredCv): CvDocument {
  const sections: Section[] = []

  if (isNotEmpty(cv.summary)) {
    sections.push({ title: SECTION_TITLES.profile, blocks: [{ type: 'paragraphe', text: cv.summary.trim() }] })
  }

  // Compétences en trois lignes étiquetées, lisibles par un humain comme par un ATS :
  // compétences clés (celles de l'offre), savoir-être, outils et techniques.
  const keys = cv.keySkills.filter(isNotEmpty)
  const { softSkills, hardSkills } = splitSoftAndHardSkills(cv.skills.filter(isNotEmpty))
  const lines = [
    { tag: 'Compétences clés', elements: keys },
    { tag: 'Savoir-être', elements: softSkills },
    { tag: 'Outils et techniques', elements: hardSkills },
  ].filter((l) => l.elements.length > 0)
  if (lines.length > 0) {
    sections.push({
      title: SECTION_TITLES.skills,
      blocks: lines.map((l) => ({ type: 'paragraphe' as const, text: `${l.tag} : ${l.elements.join(', ')}` })),
    })
  }

  // Un diplôme déjà listé en formation n'est pas une expérience (profil enregistré avant le contrôle d'import).
  const degrees = new Set(cv.education.map((f) => key(f.degree)))
  const experiences = cv.experiences.filter((e) => !degrees.has(key(e.position)))
  if (experiences.length > 0) {
    sections.push({
      title: SECTION_TITLES.experience,
      blocks: experiences.map((e) => ({
        type: 'entree' as const,
        heading: e.position,
        subtitle: joinNonEmpty(e.company, e.location),
        dateRange: e.dateRange,
        bullets: e.bullets.filter(isNotEmpty),
      })),
    })
  }

  if (cv.education.length > 0) {
    sections.push({
      title: SECTION_TITLES.education,
      blocks: cv.education.map((f) => ({
        type: 'entree' as const,
        heading: f.degree,
        subtitle: joinNonEmpty(f.school, f.location),
        dateRange: f.dateRange,
        bullets: isNotEmpty(f.description) ? [f.description.trim()] : [],
      })),
    })
  }

  if (cv.languages.length > 0) {
    sections.push({
      title: SECTION_TITLES.languages,
      blocks: [
        {
          type: 'paragraphe',
          text: cv.languages.map((l) => (isNotEmpty(l.level) ? `${l.name} (${l.level})` : l.name)).join(', '),
        },
      ],
    })
  }

  return {
    name: profile.fullName?.trim() ?? '',
    title: cv.headline.trim(),
    contact: [profile.email, profile.phone, profile.location, ...filterLinks(profile.links)].filter(isNotEmpty),
    photo: profile.photo,
    sections,
  }
}

/** Nom de fichier sûr (Windows), ex. « CV-Claire-Dubois.pdf ». */
export function cvFileName(model: CvDocument, extension: 'pdf' | 'docx'): string {
  const base = model.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `CV${base ? `-${base}` : ''}.${extension}`
}
