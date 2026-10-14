import type { Profile, TailoredCv } from '../schemas'
import { filterLinks } from '../schemas/links'
import { splitSoftAndHardSkills } from '../tailoring/skills'

// Single intermediate model: the PDF (HTML) and the DOCX are two renderings of it, hence the same order and the same
// standard section titles (read by ATS).

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; elements: string[] }
  /** « Label : a, b, c » on one line, or a subtitle followed by a list in a narrow column. */
  | { type: 'labelled-list'; label: string; elements: string[] }
  | { type: 'entry'; heading: string; subtitle?: string; dateRange?: string; bullets: string[] }

export type SectionId = 'profile' | 'skills' | 'experience' | 'education' | 'languages'

export interface Section {
  id: SectionId
  title: string
  blocks: Block[]
}

/** Language of the produced CV (not of the interface): its standard titles are the ones ATS look for. */
export type CvLanguage = 'fr'

export interface CvLabels {
  sections: Record<SectionId, string>
  contact: string
  skillLines: { key: string; soft: string; hard: string }
  /** Between a label and its terms, with the typography of the language. */
  labelSeparator: string
}

export const CV_LABELS: Record<CvLanguage, CvLabels> = {
  fr: {
    sections: {
      profile: 'Profil',
      skills: 'Compétences',
      experience: 'Expérience professionnelle',
      education: 'Formation',
      languages: 'Langues',
    },
    contact: 'Contact',
    skillLines: { key: 'Compétences clés', soft: 'Savoir-être', hard: 'Outils et techniques' },
    labelSeparator: ' : ',
  },
}

export interface CvDocument {
  language: CvLanguage
  name: string
  title: string
  contact: string[]
  /** Optional photo (data URL), taken from the profile. */
  photo?: string
  sections: Section[]
}

/** One line of text for a labelled list (main column, DOCX). */
export function labelledLine(block: { label: string; elements: string[] }, language: CvLanguage): string {
  return `${block.label}${CV_LABELS[language].labelSeparator}${block.elements.join(', ')}`
}

const isNotEmpty = (value: string | undefined): value is string => !!value?.trim()
const key = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const joinNonEmpty = (...parts: (string | undefined)[]) => parts.filter(isNotEmpty).join(', ')

/** Contact details come from the profile (the tailored CV has none). */
export function buildCvDocument(profile: Profile, cv: TailoredCv, language: CvLanguage = 'fr'): CvDocument {
  const labels = CV_LABELS[language]
  const sections: Section[] = []
  const section = (id: SectionId, blocks: Block[]) => sections.push({ id, title: labels.sections[id], blocks })

  if (isNotEmpty(cv.summary)) {
    section('profile', [{ type: 'paragraph', text: cv.summary.trim() }])
  }

  // Skills on three labelled lines, readable by a human as well as by an ATS: key skills (those of the job posting),
  // soft skills, tools and techniques.
  const keys = cv.keySkills.filter(isNotEmpty)
  const { softSkills, hardSkills } = splitSoftAndHardSkills(cv.skills.filter(isNotEmpty))
  const lines: Block[] = [
    { type: 'labelled-list' as const, label: labels.skillLines.key, elements: keys },
    { type: 'labelled-list' as const, label: labels.skillLines.soft, elements: softSkills },
    { type: 'labelled-list' as const, label: labels.skillLines.hard, elements: hardSkills },
  ].filter((l) => l.elements.length > 0)
  if (lines.length > 0) {
    section('skills', lines)
  }

  // A degree already listed in education is not an experience (profile saved before the import check).
  const degrees = new Set(cv.education.map((f) => key(f.degree)))
  const experiences = cv.experiences.filter((e) => !degrees.has(key(e.position)))
  if (experiences.length > 0) {
    section(
      'experience',
      experiences.map((e) => ({
        type: 'entry' as const,
        heading: e.position,
        subtitle: joinNonEmpty(e.company, e.location),
        dateRange: e.dateRange,
        bullets: e.bullets.filter(isNotEmpty),
      })),
    )
  }

  if (cv.education.length > 0) {
    section(
      'education',
      cv.education.map((f) => ({
        type: 'entry' as const,
        heading: f.degree,
        subtitle: joinNonEmpty(f.school, f.location),
        dateRange: f.dateRange,
        bullets: isNotEmpty(f.description) ? [f.description.trim()] : [],
      })),
    )
  }

  if (cv.languages.length > 0) {
    section('languages', [
      {
        type: 'paragraph',
        text: cv.languages.map((l) => (isNotEmpty(l.level) ? `${l.name} (${l.level})` : l.name)).join(', '),
      },
    ])
  }

  return {
    language,
    name: profile.fullName?.trim() ?? '',
    title: cv.headline.trim(),
    contact: [profile.email, profile.phone, profile.location, ...filterLinks(profile.links)].filter(isNotEmpty),
    photo: profile.photo,
    sections,
  }
}

/** Safe file name (Windows), e.g. « CV-Claire-Dubois.pdf ». */
export function cvFileName(model: CvDocument, extension: 'pdf' | 'docx'): string {
  const base = model.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `CV${base ? `-${base}` : ''}.${extension}`
}
