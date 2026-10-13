import { estTitre, nettoyerTexteOffre, preparerTexteOffre } from './texte'

/**
 * Rubriques d'une offre. La rubrique « profil recherché » est la plus utile pour adapter un CV : c'est là que
 * l'employeur liste formation, expérience, outils et qualités attendus. Elle ne doit jamais être noyée (ni tronquée)
 * dans le reste de l'annonce.
 */
export interface SectionsOffre {
  profil: string
  missions: string
  reste: string
}

const TITRE_PROFIL =
  /^(profil( recherch[ée]s?)?|votre profil|le profil|profil du candidat|vous [êe]tes|ce que nous attendons( de vous)?|ce que nous recherchons|comp[ée]tences( requises| attendues| recherch[ée]es)?|qualit[ée]s( requises| attendues)?|pr[ée]-?requis|savoir-[êe]tre|exp[ée]rience et comp[ée]tences|vos comp[ée]tences|votre bagage|votre exp[ée]rience)\s*:?$/iu

const TITRE_MISSIONS =
  /^(missions?( principales?)?|vos missions|les missions|description (du poste|de la mission)|le poste|vos activit[ée]s( principales)?|activit[ée]s( principales)?|vos responsabilit[ée]s|responsabilit[ée]s|votre r[ôo]le|ce que vous ferez|au quotidien)\s*:?$/iu

const sansSymboles = (ligne: string) => ligne.trim().replace(/^[^\p{L}\p{N}]+/u, '')

export function extraireSections(texte: string): SectionsOffre {
  const sections: Record<keyof SectionsOffre, string[]> = { profil: [], missions: [], reste: [] }
  let courante: keyof SectionsOffre = 'reste'
  for (const ligne of nettoyerTexteOffre(texte).split('\n')) {
    const l = sansSymboles(ligne)
    if (TITRE_PROFIL.test(l)) {
      courante = 'profil'
      continue
    }
    if (TITRE_MISSIONS.test(l)) {
      courante = 'missions'
      continue
    }
    // Un autre titre de rubrique referme la rubrique en cours (retour au « reste »).
    if (estTitre(ligne, true) && courante !== 'reste') courante = 'reste'
    sections[courante].push(ligne)
  }
  const joindre = (lignes: string[]) =>
    lignes
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  return { profil: joindre(sections.profil), missions: joindre(sections.missions), reste: joindre(sections.reste) }
}

const LONGUEUR_MAX_PROFIL = 2000
const LONGUEUR_MAX_MISSIONS = 2200

/**
 * Texte confié au modèle pour analyser l'offre : la rubrique « profil recherché » en premier et en entier (jusqu'à
 * 2 000 caractères), puis missions et contexte plafonnés. Sans rubrique reconnue : texte nettoyé et plafonné.
 */
export function preparerTexteAnalyse(texte: string): string {
  const { profil, missions, reste } = extraireSections(texte)
  if (profil === '') return preparerTexteOffre(texte)
  const coupe = (t: string, max: number) =>
    t.length <= max ? t : t.slice(0, t.lastIndexOf('\n', max) > 0 ? t.lastIndexOf('\n', max) : max)
  const contexte = coupe([missions, reste].filter(Boolean).join('\n\n'), LONGUEUR_MAX_MISSIONS)
  return `PROFIL RECHERCHÉ :\n${coupe(profil, LONGUEUR_MAX_PROFIL)}${contexte ? `\n\nMISSIONS ET CONTEXTE :\n${contexte}` : ''}`
}
