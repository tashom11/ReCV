import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Profil } from '../schemas'
import { borneAccroche } from './pipeline'
import { pointFidele } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'
import { motsNonAttestes } from './vocabulaire'

// Bornes minimales : avec une grammaire JSON, un modèle peut sinon répondre par la sortie la plus courte
// valide (« [] » et « "" »). `min` les exclut de la grammaire elle-même.
export const accrocheProfilSchema = z.object({
  competencesTransversales: z.array(z.string().min(2)).min(1),
  accroche: z.string().min(15),
})

const SYSTEME = `Tu es un expert en rédaction de CV.
À partir du profil fourni :
1. "competencesTransversales" : les compétences transversales du candidat, c'est-à-dire les savoir-être et qualités professionnelles utiles dans n'importe quel métier (rigueur, autonomie, organisation, communication, travail en équipe, adaptabilité, sens du détail, respect des délais, relation client, gestion de projets…). Recopie-les telles qu'elles figurent dans le profil. Exclus toute compétence propre à un métier : outils, logiciels, langages, techniques, diplômes.
2. "accroche" : 2 à 3 phrases (400 caractères maximum), écrites à la première personne du singulier (« Je … »), qui présentent le candidat uniquement par ces compétences transversales. Évite les adjectifs qui s'accordent au genre : préfère les noms (« Je fais preuve de rigueur et d'autonomie », « J'ai le sens de l'organisation ») à « je suis rigoureux ». Ne parle jamais de lui à la troisième personne (« il », « le candidat »), pour qu'elle reste valable quelle que soit l'offre visée. Ne cite aucun métier, intitulé de poste, outil, technologie, employeur, secteur d'activité, durée ni chiffre.

${REGLES_ANTI_INVENTION}`

export const MESSAGE_AUCUNE_COMPETENCE =
  'Aucune compétence transversale repérée dans ton profil. Ajoute-en (rigueur, autonomie, organisation, communication…) dans « Compétences » ou dans les réalisations, puis réessaie.'

// « de rigueur, d'autonomie et de sens du détail » (élision devant une voyelle ou un h)
function enumererAvecDe(elements: string[]): string {
  const avecDe = elements.map((e) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(e) ? `d’${e}` : `de ${e}`))
  if (avecDe.length <= 1) return avecDe.join('')
  return `${avecDe.slice(0, -1).join(', ')} et ${avecDe[avecDe.length - 1]}`
}

// Première personne exigée ; toute désignation à la troisième personne est rejetée.
const MOTIF_PREMIERE_PERSONNE = /(?:^|[^\p{L}])(?:je|mon|ma|mes)(?![\p{L}])|(?:^|[^\p{L}])j['’]/iu
const MOTIF_TROISIEME_PERSONNE = /(?:^|[^\p{L}])(?:il|elle|le candidat|la candidate|sa|son|ses)(?![\p{L}])/iu

function texteSource(profil: Profil): string {
  return [
    profil.accroche ?? '',
    ...profil.competences,
    ...profil.experiences.map(texteExperience),
    ...profil.experiences.map((e) => e.periode ?? ''),
  ].join('\n')
}

/**
 * Accroche générique fondée sur les seules compétences TRANSVERSALES du profil : elle ne cite aucun savoir-faire
 * de métier, qui pourrait ne pas correspondre aux offres visées. Le modèle propose, le code vérifie :
 * - une compétence n'est retenue que si elle figure mot pour mot dans le profil ;
 * - l'accroche est rejetée si elle cite une compétence de métier, un poste, un employeur ou un chiffre ;
 * - sinon, repli sur une phrase composée uniquement des compétences retenues.
 */
export async function genererAccrocheProfil(moteur: MoteurLLM, profil: Profil): Promise<string> {
  const contenu = {
    competences: profil.competences,
    realisations: profil.experiences.flatMap((e) => [e.description ?? '', ...e.realisations]).filter(Boolean),
    accrocheActuelle: profil.accroche,
  }
  const reponse = await moteur.genererObjet({
    nom: 'accrocheProfil',
    schema: accrocheProfilSchema,
    systeme: SYSTEME,
    utilisateur: encadrer('profil', JSON.stringify(contenu, null, 2)),
  })

  const source = texteSource(profil)
  const sourceNormalisee = normaliser(source)
  const retenues = [...new Set(reponse.competencesTransversales.map((c) => c.trim()).filter(Boolean))].filter((c) =>
    contientMot(sourceNormalisee, normaliser(c)),
  )
  if (retenues.length === 0) throw new Error(MESSAGE_AUCUNE_COMPETENCE)

  const retenuesNormalisees = new Set(retenues.map(normaliser))
  const interdits = [
    ...profil.competences.filter((c) => !retenuesNormalisees.has(normaliser(c))),
    ...profil.experiences.flatMap((e) => [e.poste, e.entreprise]),
    ...(profil.titrePoste ? [profil.titrePoste] : []),
  ].filter((terme) => terme.trim().length >= 3)

  const proposee = borneAccroche(reponse.accroche)
  const valide =
    proposee !== '' &&
    MOTIF_PREMIERE_PERSONNE.test(proposee) &&
    !MOTIF_TROISIEME_PERSONNE.test(proposee) &&
    !/\d/.test(proposee) &&
    pointFidele(proposee, source, interdits) &&
    motsNonAttestes(proposee, source).length === 0
  // Apostrophes typographiques, comme dans la phrase de repli.
  if (valide) return proposee.replace(/'/g, '’')
  return `Je fais preuve ${enumererAvecDe(retenues.slice(0, 5).map((c) => c.toLowerCase()))}.`
}

export { motsNonAttestes }
