import type { CvAdapte, Offre, Profil } from '../schemas'
import type { FournisseurLLM } from './fournisseur'

export const profilCanned: Profil = {
  nom: 'Claire Dubois',
  email: 'claire.dubois@exemple.fr',
  telephone: '06 12 34 56 78',
  adresse: 'Lyon, France',
  liensProfessionnels: ['linkedin.com/in/clairedubois'],
  titrePoste: 'Développeuse web',
  accroche:
    "Développeuse passionnée avec 5 ans d'expérience en applications web, cherchant à mettre son expertise front-end au service de produits à fort impact utilisateur.",
  experiences: [
    {
      poste: 'Développeuse front-end',
      entreprise: 'Société Alpha',
      lieu: 'Lyon',
      periode: 'Mars 2021 – présent',
      description: "Intégration et maintenance d'une application React utilisée par 50 000 clients.",
      realisations: [
        "Migration de l'application de JavaScript vers TypeScript",
        'Mise en place de tests automatisés avec Vitest, réduisant les régressions de 30 %',
        'Encadrement de deux stagiaires sur les bonnes pratiques front-end',
      ],
    },
    {
      poste: 'Développeuse web junior',
      entreprise: 'Agence Beta',
      lieu: 'Lyon',
      periode: 'Septembre 2019 – Février 2021',
      description: 'Développement de sites vitrines et e-commerce pour des clients variés.',
      realisations: [
        'Création de dix sites WordPress sur mesure',
        'Optimisation du temps de chargement des pages de 40 %',
      ],
    },
  ],
  competences: ['TypeScript', 'React', 'Node.js', 'SQL', 'Git', 'Tests automatisés'],
  formations: [
    {
      diplome: 'Master Informatique',
      etablissement: 'Université Claude Bernard Lyon 1',
      lieu: 'Lyon',
      periode: '2017 – 2019',
    },
    {
      diplome: 'Licence Informatique',
      etablissement: 'Université Claude Bernard Lyon 1',
      lieu: 'Lyon',
      periode: '2014 – 2017',
    },
  ],
  langues: [
    { nom: 'Français', niveau: 'Langue maternelle' },
    { nom: 'Anglais', niveau: 'Courant' },
  ],
}

// Ne fait aucune extraction réelle : renvoie des données codées en dur, valides par schéma.
export class FournisseurMock implements FournisseurLLM {
  async extraireProfil(_texteCv: string): Promise<Profil> {
    return profilCanned
  }

  async extraireOffre(texteOffre: string): Promise<Offre> {
    return {
      titrePoste: 'Développeur·se Front-end React (H/F)',
      entreprise: 'Société Gamma',
      lieu: 'Lyon',
      texteBrut: texteOffre,
    }
  }

  async adapterCv(profil: Profil, _offre: Offre): Promise<CvAdapte> {
    return {
      titre: profil.titrePoste ?? 'CV adapté',
      accroche: profil.accroche ?? '',
      experiences: profil.experiences.map((experience) => ({
        poste: experience.poste,
        entreprise: experience.entreprise,
        lieu: experience.lieu,
        periode: experience.periode,
        points:
          experience.realisations.length > 0
            ? experience.realisations
            : experience.description
              ? [experience.description]
              : [],
      })),
      competences: profil.competences,
      formations: profil.formations,
      langues: profil.langues,
    }
  }
}
