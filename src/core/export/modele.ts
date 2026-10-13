import { separerCompetences } from '../adaptation/competences'
import type { CvAdapte, Profil } from '../schemas'

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
const joindre = (...parties: (string | undefined)[]) => parties.filter(nonVide).join(', ')

/** Les coordonnées viennent du profil (le CV adapté n'en contient pas). */
export function construireModele(profil: Profil, cv: CvAdapte): CvModele {
  const sections: Section[] = []

  if (nonVide(cv.accroche)) {
    sections.push({ titre: TITRES_SECTIONS.profil, blocs: [{ type: 'paragraphe', texte: cv.accroche.trim() }] })
  }

  // Compétences en trois lignes étiquetées, lisibles par un humain comme par un ATS :
  // compétences clés (celles de l'offre), savoir-être, outils et techniques.
  const cles = cv.competencesCles.filter(nonVide)
  const { savoirEtre, techniques } = separerCompetences(cv.competences.filter(nonVide))
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

  if (cv.experiences.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.experience,
      blocs: cv.experiences.map((e) => ({
        type: 'entree' as const,
        intitule: e.poste,
        sousTitre: joindre(e.entreprise, e.lieu),
        periode: e.periode,
        points: e.points.filter(nonVide),
      })),
    })
  }

  if (cv.formations.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.formation,
      blocs: cv.formations.map((f) => ({
        type: 'entree' as const,
        intitule: f.diplome,
        sousTitre: joindre(f.etablissement, f.lieu),
        periode: f.periode,
        points: nonVide(f.description) ? [f.description.trim()] : [],
      })),
    })
  }

  if (cv.langues.length > 0) {
    sections.push({
      titre: TITRES_SECTIONS.langues,
      blocs: [
        {
          type: 'paragraphe',
          texte: cv.langues.map((l) => (nonVide(l.niveau) ? `${l.nom} (${l.niveau})` : l.nom)).join(', '),
        },
      ],
    })
  }

  return {
    nom: profil.nom?.trim() ?? '',
    titre: cv.titre.trim(),
    contact: [profil.email, profil.telephone, profil.adresse, ...profil.liensProfessionnels].filter(nonVide),
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
