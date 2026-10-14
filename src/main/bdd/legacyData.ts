// Conversion of the data stored by v0.2.1 (French JSON keys) to the current keys. Used by database migration 2.
// Unknown keys are kept as they are, so a value already converted goes through unchanged.

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Renames the keys of `value` (`map`: old → new) and converts the listed children with their own converter. */
function convert(
  value: unknown,
  map: Record<string, string>,
  children: Record<string, (child: unknown) => unknown> = {},
): unknown {
  if (!isObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      const newKey = map[key] ?? key
      const childConverter = children[newKey]
      return [newKey, childConverter ? childConverter(child) : child]
    }),
  )
}

const eachOf = (converter: (item: unknown) => unknown) => (list: unknown) =>
  Array.isArray(list) ? list.map(converter) : list

const experience = (v: unknown) =>
  convert(v, {
    poste: 'position',
    entreprise: 'company',
    lieu: 'location',
    periode: 'dateRange',
    realisations: 'achievements',
  })
const education = (v: unknown) =>
  convert(v, { diplome: 'degree', etablissement: 'school', lieu: 'location', periode: 'dateRange' })
const language = (v: unknown) => convert(v, { nom: 'name', niveau: 'level' })
const tailoredExperience = (v: unknown) =>
  convert(v, {
    indice: 'sourceIndex',
    poste: 'position',
    entreprise: 'company',
    lieu: 'location',
    periode: 'dateRange',
    points: 'bullets',
  })

const STATUS: Record<string, string> = {
  insuffisante: 'insufficient',
  inconnue: 'unknown',
  retrouvee: 'found',
  'non-retrouvee': 'not-found',
}
const requirement = (v: unknown) => {
  const converted = convert(v, { exigee: 'required', statut: 'status', profil: 'profileValue' })
  if (isObject(converted) && typeof converted.status === 'string') {
    return { ...converted, status: STATUS[converted.status] ?? converted.status }
  }
  return converted
}

export const profileFromV1 = (v: unknown) =>
  convert(
    v,
    {
      nom: 'fullName',
      telephone: 'phone',
      adresse: 'location',
      liensProfessionnels: 'links',
      titrePoste: 'headline',
      accroche: 'summary',
      competences: 'skills',
      formations: 'education',
      langues: 'languages',
    },
    { experiences: eachOf(experience), education: eachOf(education), languages: eachOf(language) },
  )

export const jobPostingFromV1 = (v: unknown) =>
  convert(v, { titrePoste: 'jobTitle', entreprise: 'company', lieu: 'location', texteBrut: 'rawText' })

export const tailoredCvFromV1 = (v: unknown) =>
  convert(
    v,
    {
      titre: 'headline',
      accroche: 'summary',
      competencesCles: 'keySkills',
      competences: 'skills',
      formations: 'education',
      langues: 'languages',
      ecartes: 'excluded',
      demandees: 'requested',
    },
    {
      experiences: eachOf(tailoredExperience),
      education: eachOf(education),
      languages: eachOf(language),
      excluded: (e) =>
        convert(
          e,
          { competences: 'skills', formations: 'education' },
          { experiences: eachOf(tailoredExperience), education: eachOf(education) },
        ),
      requested: (r) =>
        convert(
          r,
          { attestees: 'evidenced', manquantes: 'missing', prerequis: 'requirements' },
          {
            requirements: (p) =>
              convert(p, { formation: 'education' }, { education: requirement, experience: requirement }),
          },
        ),
    },
  )
