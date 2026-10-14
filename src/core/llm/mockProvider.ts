import type { JobPosting, Profile, TailoredCv } from '../schemas'
import type { JobAnalysis } from '../tailoring/jobAnalysis'
import type { LlmProvider, TailoringOptions } from './provider'

export const cannedProfile: Profile = {
  fullName: 'Claire Dubois',
  email: 'claire.dubois@exemple.fr',
  phone: '06 12 34 56 78',
  location: 'Lyon, France',
  links: ['linkedin.com/in/clairedubois'],
  headline: 'Développeuse web',
  summary:
    "Développeuse passionnée avec 5 ans d'expérience en applications web, cherchant à mettre son expertise front-end au service de produits à fort impact utilisateur.",
  experiences: [
    {
      position: 'Développeuse front-end',
      company: 'Société Alpha',
      location: 'Lyon',
      dateRange: 'Mars 2021 – présent',
      description: "Intégration et maintenance d'une application React utilisée par 50 000 clients.",
      achievements: [
        "Migration de l'application de JavaScript vers TypeScript",
        'Mise en place de tests automatisés avec Vitest, réduisant les régressions de 30 %',
        'Encadrement de deux stagiaires sur les bonnes pratiques front-end',
      ],
    },
    {
      position: 'Développeuse web junior',
      company: 'Agence Beta',
      location: 'Lyon',
      dateRange: 'Septembre 2019 – Février 2021',
      description: 'Développement de sites vitrines et e-commerce pour des clients variés.',
      achievements: [
        'Création de dix sites WordPress sur mesure',
        'Optimisation du temps de chargement des pages de 40 %',
      ],
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js', 'SQL', 'Git', 'Tests automatisés'],
  education: [
    {
      degree: 'Master Informatique',
      school: 'Université Claude Bernard Lyon 1',
      location: 'Lyon',
      dateRange: '2017 – 2019',
    },
    {
      degree: 'Licence Informatique',
      school: 'Université Claude Bernard Lyon 1',
      location: 'Lyon',
      dateRange: '2014 – 2017',
    },
  ],
  languages: [
    { name: 'Français', level: 'Langue maternelle' },
    { name: 'Anglais', level: 'Courant' },
  ],
}

// Ne fait aucune extraction réelle : renvoie des données codées en dur, valides par schéma.
export class MockProvider implements LlmProvider {
  async extractProfile(_cvText: string): Promise<Profile> {
    return cannedProfile
  }

  async extractJobPosting(jobPostingText: string): Promise<JobPosting> {
    return {
      jobTitle: 'Développeur·se Front-end React (H/F)',
      company: 'Société Gamma',
      location: 'Lyon',
      rawText: jobPostingText,
    }
  }

  async analyzeJobPosting(jobPosting: JobPosting): Promise<JobAnalysis> {
    return {
      targetTitle: jobPosting.jobTitle,
      requiredSkills: ['React', 'TypeScript', 'Figma'],
      softSkills: ['Autonomie'],
      keywords: [],
      requiredEducation: '',
      requiredExperience: '',
    }
  }

  async generateSummary(profile: Profile): Promise<string> {
    return `Je fais preuve de ${profile.skills.slice(0, 3).join(', ')}.`
  }

  async tailorCv(profile: Profile, _jobPosting: JobPosting, options?: TailoringOptions): Promise<TailoredCv> {
    options?.signal?.throwIfAborted()
    return {
      headline: profile.headline ?? 'CV adapté',
      summary: profile.summary ?? '',
      experiences: profile.experiences.map((experience) => ({
        position: experience.position,
        company: experience.company,
        location: experience.location,
        dateRange: experience.dateRange,
        bullets:
          experience.achievements.length > 0
            ? experience.achievements
            : experience.description
              ? [experience.description]
              : [],
      })),
      skills: profile.skills,
      education: profile.education,
      languages: profile.languages,
      excluded: { experiences: [], skills: [], education: [] },
      keySkills: [],
      requested: { evidenced: [], missing: [], requirements: {} },
    }
  }
}
