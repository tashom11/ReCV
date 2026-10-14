import { type Profile, profileSchema } from '../schemas'
import { filterLinks } from '../schemas/links'
import { isShortSkill, splitSkills } from '../tailoring/skills'

// Un modèle qui extrait un CV peut inventer des entrées (une « expérience » faite d'une ligne « Permis B –
// Disponibilité immédiate »), ou en créer à partir d'une simple compétence. Ce contrôle en code garde uniquement
// ce qui est attesté dans le texte du CV.

/** Minuscules sans accents ni ligatures. */
function simplify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Texte réduit à ses lettres et chiffres : insensible aux espaces, tirets, retours à la ligne de l'extraction PDF. */
function compact(text: string): string {
  return simplify(text).replace(/[^\p{L}\p{N}]/gu, '')
}

function significantWords(value: string): string[] {
  return simplify(value).match(/[\p{L}\p{N}]{3,}/gu) ?? []
}

/** Vrai si au moins 75 % des mots significatifs de `valeur` figurent dans le CV (vrai si rien à vérifier). */
function isInSource(value: string | undefined, compactSource: string): boolean {
  const words = significantWords(value ?? '')
  if (words.length === 0) return true
  return words.filter((word) => compactSource.includes(word)).length / words.length >= 0.75
}

/** Un « poste » identique à l'intitulé d'une formation est un diplôme rangé à tort dans les expériences. */
function isDegree(position: string | undefined, education: Profile['education']): boolean {
  const key = compact(position ?? '')
  return key !== '' && education.some((f) => compact(f.degree ?? '') === key)
}

const vide = (value: string | undefined) => !value || value.trim() === ''

/**
 * Retire du profil extrait ce qui n'est pas attesté dans `texteCv` :
 * - expérience sans entreprise ni période (poste fantôme, ligne diverse prise pour une expérience), ou dont le
 *   poste ou l'entreprise n'apparaît pas dans le CV ;
 * - formation, langue, compétence, e-mail ou téléphone absents du CV ;
 * - doublons et valeurs vides.
 */
export function sanitizeProfile(profile: Profile, cvText: string): Profile {
  const source = compact(cvText)
  const sourceDigits = cvText.replace(/\D/g, '')

  // Doublons (casse et accents ignorés) : la première occurrence est conservée.
  const seenKeys = new Set<string>()
  const skills = splitSkills(profile.skills.map((c) => c.trim()))
    // Une compétence est un terme court : les phrases décrivant des tâches n'en sont pas.
    .filter((c) => c !== '' && isShortSkill(c) && isInSource(c, source))
    .filter((c) => {
      const key = simplify(c)
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

  const emailEvidenced = !vide(profile.email) && source.includes(compact(profile.email ?? ''))
  const phoneDigits = (profile.phone ?? '').replace(/\D/g, '')
  const phoneEvidenced = phoneDigits.length >= 6 && sourceDigits.includes(phoneDigits)

  return profileSchema.parse({
    ...profile,
    fullName: isInSource(profile.fullName, source) ? profile.fullName : undefined,
    email: emailEvidenced ? profile.email : undefined,
    phone: phoneEvidenced ? profile.phone : undefined,
    headline: isInSource(profile.headline, source) ? profile.headline : undefined,
    experiences: profile.experiences.filter(
      (e) =>
        !vide(e.position) &&
        !isDegree(e.position, profile.education) &&
        (!vide(e.company) || !vide(e.dateRange)) &&
        isInSource(e.position, source) &&
        isInSource(e.company, source),
    ),
    education: profile.education.filter(
      (f) => (!vide(f.degree) || !vide(f.school)) && isInSource(f.degree, source) && isInSource(f.school, source),
    ),
    languages: profile.languages.filter((l) => !vide(l.name) && isInSource(l.name, source)),
    skills: skills,
    links: filterLinks(profile.links),
  })
}
