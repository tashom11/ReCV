import { eclaterCompetences, estCompetenceCourte } from '../adaptation/competences'
import { type Profile, profileSchema } from '../schemas'
import { filterLinks } from '../schemas/links'

// Un modèle qui extrait un CV peut inventer des entrées (une « expérience » faite d'une ligne « Permis B –
// Disponibilité immédiate »), ou en créer à partir d'une simple compétence. Ce contrôle en code garde uniquement
// ce qui est attesté dans le texte du CV.

/** Minuscules sans accents ni ligatures. */
function simplifier(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Texte réduit à ses lettres et chiffres : insensible aux espaces, tirets, retours à la ligne de l'extraction PDF. */
function compacter(texte: string): string {
  return simplifier(texte).replace(/[^\p{L}\p{N}]/gu, '')
}

function motsSignificatifs(valeur: string): string[] {
  return simplifier(valeur).match(/[\p{L}\p{N}]{3,}/gu) ?? []
}

/** Vrai si au moins 75 % des mots significatifs de `valeur` figurent dans le CV (vrai si rien à vérifier). */
function presentDansSource(valeur: string | undefined, sourceCompacte: string): boolean {
  const mots = motsSignificatifs(valeur ?? '')
  if (mots.length === 0) return true
  return mots.filter((mot) => sourceCompacte.includes(mot)).length / mots.length >= 0.75
}

/** Un « poste » identique à l'intitulé d'une formation est un diplôme rangé à tort dans les expériences. */
function estDiplome(poste: string | undefined, formations: Profile['education']): boolean {
  const cle = compacter(poste ?? '')
  return cle !== '' && formations.some((f) => compacter(f.degree ?? '') === cle)
}

const vide = (valeur: string | undefined) => !valeur || valeur.trim() === ''

/**
 * Retire du profil extrait ce qui n'est pas attesté dans `texteCv` :
 * - expérience sans entreprise ni période (poste fantôme, ligne diverse prise pour une expérience), ou dont le
 *   poste ou l'entreprise n'apparaît pas dans le CV ;
 * - formation, langue, compétence, e-mail ou téléphone absents du CV ;
 * - doublons et valeurs vides.
 */
export function assainirProfil(profil: Profile, texteCv: string): Profile {
  const source = compacter(texteCv)
  const chiffresSource = texteCv.replace(/\D/g, '')

  // Doublons (casse et accents ignorés) : la première occurrence est conservée.
  const vues = new Set<string>()
  const competences = eclaterCompetences(profil.skills.map((c) => c.trim()))
    // Une compétence est un terme court : les phrases décrivant des tâches n'en sont pas.
    .filter((c) => c !== '' && estCompetenceCourte(c) && presentDansSource(c, source))
    .filter((c) => {
      const cle = simplifier(c)
      if (vues.has(cle)) return false
      vues.add(cle)
      return true
    })

  const emailAttesté = !vide(profil.email) && source.includes(compacter(profil.email ?? ''))
  const chiffresTel = (profil.phone ?? '').replace(/\D/g, '')
  const telAttesté = chiffresTel.length >= 6 && chiffresSource.includes(chiffresTel)

  return profileSchema.parse({
    ...profil,
    fullName: presentDansSource(profil.fullName, source) ? profil.fullName : undefined,
    email: emailAttesté ? profil.email : undefined,
    phone: telAttesté ? profil.phone : undefined,
    headline: presentDansSource(profil.headline, source) ? profil.headline : undefined,
    experiences: profil.experiences.filter(
      (e) =>
        !vide(e.position) &&
        !estDiplome(e.position, profil.education) &&
        (!vide(e.company) || !vide(e.dateRange)) &&
        presentDansSource(e.position, source) &&
        presentDansSource(e.company, source),
    ),
    education: profil.education.filter(
      (f) =>
        (!vide(f.degree) || !vide(f.school)) &&
        presentDansSource(f.degree, source) &&
        presentDansSource(f.school, source),
    ),
    languages: profil.languages.filter((l) => !vide(l.name) && presentDansSource(l.name, source)),
    skills: competences,
    links: filterLinks(profil.links),
  })
}
