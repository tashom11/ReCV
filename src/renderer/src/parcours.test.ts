import { decoderErreur, encoderErreur } from '@core/canaux'
import { describe, expect, it } from 'vitest'
import { decrireErreur, estAnnulation, messageErreur } from './erreurs'
import {
  avancement,
  debit,
  depuis,
  dureeAnnoncee,
  ESTIMATION_DEFAUT_S,
  enregistrerDuree,
  formaterTaille,
  lireEstimation,
  restantCreation,
  restantTelechargement,
} from './estimation'
import {
  apresCommencer,
  enteteDeVue,
  etapeCreationCourante,
  etapeDeVue,
  etapesFaites,
  initiales,
  lieuEnregistrement,
  moteurPret,
  titreSansMention,
  vueDeEtape,
  vueInitiale,
} from './parcours'

describe('parcours', () => {
  it('ouvre sur l’accueil sans CV enregistré, sinon directement sur l’annonce', () => {
    expect(vueInitiale(false)).toBe('accueil')
    expect(vueInitiale(true)).toBe('annonce')
  })

  it('passe par la préparation tant que le moteur n’est pas prêt', () => {
    expect(apresCommencer(false)).toBe('preparation')
    expect(apresCommencer(true)).toBe('cv')
  })

  it('juge le moteur prêt avec un service configuré ou un modèle présent', () => {
    expect(moteurPret({ fournisseur: 'local', cheminModeleLocal: undefined }, [{ installe: false }])).toBe(false)
    expect(moteurPret({ fournisseur: 'local', cheminModeleLocal: undefined }, [{ installe: true }])).toBe(true)
    expect(moteurPret({ fournisseur: 'local', cheminModeleLocal: 'C:\\m.gguf' }, [])).toBe(true)
    expect(moteurPret({ fournisseur: 'ollama', cheminModeleLocal: undefined }, [])).toBe(true)
    expect(moteurPret({ fournisseur: 'api', cheminModeleLocal: undefined }, [])).toBe(true)
  })

  it('relie les vues aux trois étapes', () => {
    expect(etapeDeVue('cv')).toBe(1)
    expect(etapeDeVue('annonce')).toBe(2)
    expect(etapeDeVue('creation')).toBe(3)
    expect(etapeDeVue('resultat')).toBe(3)
    expect(etapeDeVue('succes')).toBeNull()
    expect(etapeDeVue('reglages')).toBeNull()
    expect([1, 2, 3].map((e) => vueDeEtape(e as 1 | 2 | 3))).toEqual(['cv', 'annonce', 'resultat'])
  })

  it('ne marque une étape faite que si les précédentes le sont', () => {
    expect(etapesFaites({ profilPresent: false, annonceConfirmee: true, exporte: true })).toEqual([])
    expect(etapesFaites({ profilPresent: true, annonceConfirmee: false, exporte: true })).toEqual([1])
    expect(etapesFaites({ profilPresent: true, annonceConfirmee: true, exporte: false })).toEqual([1, 2])
    expect(etapesFaites({ profilPresent: true, annonceConfirmee: true, exporte: true })).toEqual([1, 2, 3])
  })

  it('masque les étapes à l’accueil et les réglages pendant une attente', () => {
    expect(enteteDeVue('accueil')).toEqual({ etapes: false, reglages: true })
    expect(enteteDeVue('preparation')).toEqual({ etapes: false, reglages: false })
    expect(enteteDeVue('creation')).toEqual({ etapes: true, reglages: false })
    expect(enteteDeVue('succes')).toEqual({ etapes: true, reglages: false })
    expect(enteteDeVue('annonce')).toEqual({ etapes: true, reglages: true })
  })

  it('suit les étapes de la création, l’annonce déjà lue comptant pour faite', () => {
    expect(etapeCreationCourante(undefined, false, false)).toBe(0)
    expect(etapeCreationCourante('analyse', false, false)).toBe(0)
    expect(etapeCreationCourante('preparation', true, false)).toBe(1)
    expect(etapeCreationCourante('selection', true, false)).toBe(1)
    expect(etapeCreationCourante('reformulation', false, false)).toBe(1)
    expect(etapeCreationCourante('accroche', true, false)).toBe(2)
    expect(etapeCreationCourante('accroche', true, true)).toBe(3)
  })

  it('dit simplement où le fichier est enregistré', () => {
    expect(lieuEnregistrement('C:\\Users\\Camille\\Desktop\\CV-Camille-Martin.pdf')).toEqual({
      fichier: 'CV-Camille-Martin.pdf',
      lieu: 'Enregistré sur votre Bureau',
    })
    expect(lieuEnregistrement('C:\\Users\\Camille\\Documents\\cv.docx').lieu).toBe('Enregistré dans vos Documents')
    expect(lieuEnregistrement('D:\\Candidatures\\cv.pdf').lieu).toBe('Enregistré dans le dossier « Candidatures »')
    expect(lieuEnregistrement('cv.pdf').lieu).toBe('Enregistré sur votre ordinateur')
  })

  it('cite le poste sans la mention (H/F)', () => {
    expect(titreSansMention('Agent d’accueil polyvalent (H/F)')).toBe('Agent d’accueil polyvalent')
    expect(titreSansMention('Développeur [F/H/X] React')).toBe('Développeur React')
    expect(titreSansMention('Comptable')).toBe('Comptable')
    expect(titreSansMention('(H/F)')).toBe('(H/F)')
  })

  it('tire les initiales du nom', () => {
    expect(initiales('Camille Martin')).toBe('CM')
    expect(initiales('  jean-pierre de la fontaine ')).toBe('JF')
    expect(initiales('Camille')).toBe('C')
    expect(initiales(undefined)).toBe('')
  })
})

describe('erreurs', () => {
  const erreur = (code: string | undefined, message = 'détail technique') => new Error(encoderErreur(message, code))

  it('fait voyager le code en tête du message et le retire à l’affichage', () => {
    expect(decoderErreur(encoderErreur('Création annulée.', 'annule'))).toEqual({
      code: 'annule',
      message: 'Création annulée.',
    })
    expect(decoderErreur('Message [[sans]] code')).toEqual({ message: 'Message [[sans]] code' })
    expect(messageErreur(erreur('reseau', 'site injoignable'))).toBe('site injoignable')
    expect(estAnnulation(erreur('annule'))).toBe(true)
    expect(estAnnulation(erreur(undefined))).toBe(false)
  })

  it('propose de coller le texte quand le site bloque la lecture', () => {
    for (const code of ['site-protege', 'http', 'contenu-vide', 'contenu-non-html']) {
      const d = decrireErreur('annonce', erreur(code))
      expect(d.titre).toBe('Ce site ne nous laisse pas lire l’annonce')
      expect(d.actions).toEqual(['coller-texte'])
      expect(d.details).toBe('détail technique')
    }
  })

  it('distingue l’absence de connexion, sur un ton d’information', () => {
    const d = decrireErreur('annonce', erreur('reseau'))
    expect(d.type).toBe('info')
    expect(d.titre).toBe('Pas de connexion internet')
    expect(d.actions).toEqual(['coller-texte', 'reessayer'])
  })

  it('renvoie vers la préparation quand le moteur manque, quelle que soit l’étape', () => {
    for (const contexte of ['cv', 'annonce', 'creation'] as const) {
      const d = decrireErreur(contexte, erreur('moteur-absent'))
      expect(d.type).toBe('avertissement')
      expect(d.actions).toEqual(['terminer-preparation'])
    }
  })

  it('donne une action à chaque autre cas, sans jamais reprendre le message technique dans le texte', () => {
    expect(decrireErreur('cv', erreur('fichier-illisible')).actions).toEqual(['choisir-fichier'])
    expect(decrireErreur('export', erreur('ecriture-impossible')).actions).toEqual(['choisir-dossier', 'reessayer'])
    expect(decrireErreur('creation', erreur(undefined)).titre).toBe('La création s’est arrêtée en route')
    expect(decrireErreur('preparation', erreur(undefined)).actions).toEqual(['reprendre'])
    for (const contexte of ['cv', 'annonce', 'creation', 'export', 'preparation', 'reglages'] as const) {
      const d = decrireErreur(contexte, erreur(undefined, 'ECONNRESET at TLSSocket'))
      expect(`${d.titre} ${d.texte}`).not.toContain('ECONNRESET')
      expect(d.details).toContain('ECONNRESET')
    }
  })
})

describe('estimation', () => {
  const stockage = () => {
    const valeurs = new Map<string, string>()
    return { getItem: (c: string) => valeurs.get(c) ?? null, setItem: (c: string, v: string) => void valeurs.set(c, v) }
  }

  it('reprend la durée de la création précédente, sinon deux minutes', () => {
    const s = stockage()
    expect(lireEstimation(s)).toBe(ESTIMATION_DEFAUT_S)
    enregistrerDuree(s, 187.4)
    expect(lireEstimation(s)).toBe(187)
    enregistrerDuree(s, 0)
    expect(lireEstimation(s)).toBe(187)
    enregistrerDuree(s, 4)
    expect(lireEstimation(s)).toBe(20)
  })

  it('annonce les durées en minutes rondes', () => {
    expect(dureeAnnoncee(120)).toBe('Environ 2 minutes')
    expect(dureeAnnoncee(70)).toBe('Environ 1 minute')
    expect(dureeAnnoncee(30)).toBe('Moins d’une minute')
    expect(restantCreation(65, 120)).toBe('Encore environ 1 minute')
    expect(restantCreation(0, 300)).toBe('Encore environ 5 minutes')
    expect(restantCreation(100, 120)).toBe('Encore moins d’une minute')
    expect(restantCreation(200, 120)).toBe('Presque terminé')
    expect(depuis(65)).toBe('Depuis 1 min 05 s')
    expect(depuis(9)).toBe('Depuis 9 s')
  })

  it('ne remplit jamais la barre avant la fin', () => {
    expect(avancement(60, 120)).toBe(0.5)
    expect(avancement(500, 120)).toBe(0.95)
    expect(avancement(10, 0)).toBe(0)
  })

  it('écrit les tailles et le temps de téléchargement restant', () => {
    expect(formaterTaille(2_740_937_888)).toBe('2,6 Go')
    expect(formaterTaille(1_280_835_840)).toBe('1,2 Go')
    expect(formaterTaille(500 * 1024 ** 2)).toBe('500 Mo')
    const d = debit({ octets: 0, instantMs: 0 }, { octets: 50_000_000, instantMs: 10_000 })
    expect(d).toBe(5_000_000)
    expect(debit({ octets: 0, instantMs: 0 }, { octets: 10, instantMs: 1_000 })).toBeNull()
    expect(restantTelechargement(1_000_000_000, 2_800_000_000, d)).toBe('environ 6 minutes restantes')
    expect(restantTelechargement(2_700_000_000, 2_800_000_000, d)).toBe('moins d’une minute restante')
    expect(restantTelechargement(0, 100, null)).toBeNull()
  })
})
