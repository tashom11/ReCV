import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Parametres } from '@core/api'
import { type FournisseurLLM, FournisseurMock, profilCanned } from '@core/llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ouvrirBdd } from './bdd/connexion'
import { enregistrerProfil, obtenirProfilActif } from './bdd/depots'
import { lireCv } from './lectureCv'
import { GestionnaireModeles } from './modeles/gestionnaire'
import { type Chiffreur, StockageParametres } from './parametres'
import { creerService } from './service'

// Faux chiffreur : inverse les octets (suffisant pour vérifier que rien n'est écrit en clair).
const chiffreurFactice = (disponible = true): Chiffreur => ({
  disponible: () => disponible,
  chiffrer: (t) => Buffer.from(t, 'utf8').reverse(),
  dechiffrer: (b) => Buffer.from(b).reverse().toString('utf8'),
})

let dossier: string
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'recv-test-'))
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

describe('BDD', () => {
  it('enregistre puis met à jour le profil actif', () => {
    const bdd = ouvrirBdd(':memory:')
    expect(obtenirProfilActif(bdd)).toBeNull()
    const premier = enregistrerProfil(bdd, profilCanned)
    const second = enregistrerProfil(bdd, { ...profilCanned, nom: 'Autre' })
    expect(second.id).toBe(premier.id)
    expect(obtenirProfilActif(bdd)?.profil.nom).toBe('Autre')
    bdd.fermer()
  })
})

describe('StockageParametres', () => {
  it('chiffre la clé API sur disque et ne l’expose pas dans l’état', async () => {
    const stockage = new StockageParametres(dossier, chiffreurFactice())
    const etat = await stockage.definirCle('sk-secret-123')
    expect(etat.cleApiDefinie).toBe(true)
    expect(JSON.stringify(etat)).not.toContain('sk-secret')
    expect((await readFile(join(dossier, 'cle-api.bin'))).toString('utf8')).not.toContain('sk-secret')
    expect(await stockage.lireCle()).toBe('sk-secret-123')
    expect((await stockage.definirCle('')).cleApiDefinie).toBe(false)
  })

  it('refuse de stocker la clé sans chiffrement disponible', async () => {
    const stockage = new StockageParametres(dossier, chiffreurFactice(false))
    await expect(stockage.definirCle('sk-x')).rejects.toThrow(/chiffrement/)
  })

  it('retombe sur les valeurs par défaut si le fichier est absent', async () => {
    const stockage = new StockageParametres(dossier, chiffreurFactice())
    expect((await stockage.lire()).fournisseur).toBe('local')
  })
})

describe('service', () => {
  function service(fabrique: () => FournisseurLLM = () => new FournisseurMock()) {
    const bdd = ouvrirBdd(':memory:')
    const parametres = new StockageParametres(dossier, chiffreurFactice())
    let recu: { parametres: Parametres; cle: string | null } | undefined
    const ouverts: string[] = []
    const api = creerService({
      bdd,
      parametres,
      modeles: new GestionnaireModeles({
        dossier: join(dossier, 'modeles'),
        ressources: async () => ({ ramGo: 8, vramGo: 0 }),
        emettre: () => undefined,
      }),
      choisirEtLireCv: async () => 'texte du cv',
      lireCv: async (chemin) => `texte de ${chemin}`,
      ouvrirChemin: async (chemin) => void ouverts.push(`ouvrir:${chemin}`),
      montrerChemin: (chemin) => void ouverts.push(`montrer:${chemin}`),
      rendreHtml: async () => '',
      choisirDestination: async (nom, extension) => join(dossier, nom.replace(/.w+$/, `.${extension}`)),
      genererPdf: async (html) => Buffer.from(`%PDF-fake ${html.length}`),
      creerFournisseur: async (p, cle) => {
        recu = { parametres: p, cle }
        return fabrique()
      },
    })
    return { api, bdd, lireRecu: () => recu, ouverts }
  }

  it('importe un CV puis adapte à une offre et enregistre le résultat', async () => {
    const { api } = service()
    expect(await api.adapterCv({ titrePoste: 'Dev', texteBrut: 'x' }).catch((e: Error) => e.message)).toMatch(
      /importez d’abord/,
    )
    const importe = await api.importerCv()
    expect(importe?.profil.nom).toBeTruthy()
    const offre = await api.analyserTexteOffre('Offre développeur React')
    const genere = await api.adapterCv(offre)
    expect(genere.cv.titre).toBeTruthy()
    expect(genere.id).toBeGreaterThan(0)
  })

  it('exporte le CV validé en PDF et DOCX avec les coordonnées du profil', async () => {
    const { api } = service()
    const cvCanned = await new FournisseurMock().adapterCv(profilCanned, { titrePoste: 'Dev', texteBrut: 'x' })
    await expect(api.exporterCv(cvCanned, 'pdf')).rejects.toThrow(/importez d’abord/)
    await api.importerCv()
    const pdf = await api.exporterCv(cvCanned, 'pdf')
    const docx = await api.exporterCv(cvCanned, 'docx')
    expect(pdf).toMatch(/CV-Claire-Dubois.pdf$/)
    expect((await readFile(pdf as string)).toString().startsWith('%PDF')).toBe(true)
    expect((await readFile(docx as string)).subarray(0, 2).toString()).toBe('PK')
  })

  it('importe un CV déposé dans la fenêtre, désigné par son chemin', async () => {
    const { api } = service()
    const importe = await api.importerCvDepose('C:\\cv\\mon-cv.pdf')
    expect(importe.profil.nom).toBeTruthy()
    expect((await api.obtenirProfil())?.id).toBe(importe.id)
  })

  it('analyse l’annonce une seule fois : la carte de confirmation et l’adaptation partagent le résultat', async () => {
    const mock = new FournisseurMock()
    let analysesDemandees = 0
    let analyseRecue = false
    const { api } = service(() => ({
      extraireProfil: (t) => mock.extraireProfil(t),
      extraireOffre: (t) => mock.extraireOffre(t),
      genererAccroche: (p) => mock.genererAccroche(p),
      analyserOffre: (o) => {
        analysesDemandees++
        return mock.analyserOffre(o)
      },
      adapterCv: (p, o, options) => {
        analyseRecue = options?.analyse !== undefined
        return mock.adapterCv(p, o, options)
      },
    }))
    const offre = { titrePoste: 'Développeur React', texteBrut: 'Poste en CDI à temps plein. React, Figma.' }
    await expect(api.analyserAnnonce(offre)).rejects.toMatchObject({ code: 'profil-absent' })

    await api.importerCv()
    const apercu = await api.analyserAnnonce(offre)
    // « React » et « TypeScript » sont dans le profil, « Figma » non : tout ce que l'annonce demande est listé.
    expect(apercu.recherchees).toEqual(['React', 'TypeScript', 'Figma', 'Autonomie'])
    expect(apercu.contrat).toBe('CDI · temps plein')

    await api.analyserAnnonce(offre)
    await api.adapterCv(offre)
    expect(analysesDemandees).toBe(1)
    expect(analyseRecue).toBe(true)
  })

  it('annule une adaptation en cours : l’appel échoue avec le code « annule » et rien n’est enregistré', async () => {
    const mock = new FournisseurMock()
    let demarre: () => void = () => undefined
    const enCours = new Promise<void>((resoudre) => {
      demarre = resoudre
    })
    const { api } = service(() => ({
      extraireProfil: (t) => mock.extraireProfil(t),
      extraireOffre: (t) => mock.extraireOffre(t),
      genererAccroche: (p) => mock.genererAccroche(p),
      analyserOffre: (o) => mock.analyserOffre(o),
      // Attend l'annulation, comme un modèle en pleine génération.
      adapterCv: (_p, _o, options) =>
        new Promise((_resoudre, rejeter) => {
          options?.signal?.addEventListener('abort', () => rejeter(options.signal?.reason))
          demarre()
        }),
    }))
    await api.importerCv()
    const adaptation = api.adapterCv({ titrePoste: 'Dev', texteBrut: 'x' })
    await enCours
    await api.annulerAdaptation()
    await expect(adaptation).rejects.toMatchObject({ code: 'annule' })
    // Annuler sans adaptation en cours ne fait rien.
    await expect(api.annulerAdaptation()).resolves.toBeUndefined()
  })

  it('n’ouvre que les fichiers créés par l’export de la session', async () => {
    const { api, ouverts } = service()
    const cvCanned = await new FournisseurMock().adapterCv(profilCanned, { titrePoste: 'Dev', texteBrut: 'x' })
    await api.importerCv()
    const pdf = (await api.exporterCv(cvCanned, 'pdf')) as string

    await api.ouvrirFichier(pdf)
    await api.montrerDansDossier(pdf)
    expect(ouverts).toEqual([`ouvrir:${pdf}`, `montrer:${pdf}`])

    await expect(api.ouvrirFichier('C:\\Windows\\System32\\cmd.exe')).rejects.toThrow(/pas été créé par Re:CV/)
    await expect(api.montrerDansDossier(join(dossier, 'autre.pdf'))).rejects.toThrow(/pas été créé par Re:CV/)
    expect(ouverts).toHaveLength(2)
  })

  it('signale un dossier où l’on ne peut pas écrire avec le code « ecriture-impossible »', async () => {
    const bdd = ouvrirBdd(':memory:')
    const api = creerService({
      bdd,
      parametres: new StockageParametres(dossier, chiffreurFactice()),
      modeles: new GestionnaireModeles({
        dossier: join(dossier, 'modeles'),
        ressources: async () => ({ ramGo: 8, vramGo: 0 }),
        emettre: () => undefined,
      }),
      choisirEtLireCv: async () => 'cv',
      lireCv: async () => 'cv',
      ouvrirChemin: async () => undefined,
      montrerChemin: () => undefined,
      rendreHtml: async () => '',
      // Dossier inexistant : l'écriture échoue.
      choisirDestination: async () => join(dossier, 'absent', 'cv.pdf'),
      genererPdf: async () => Buffer.from('%PDF'),
      creerFournisseur: async () => new FournisseurMock(),
    })
    await api.importerCv()
    const cvCanned = await new FournisseurMock().adapterCv(profilCanned, { titrePoste: 'Dev', texteBrut: 'x' })
    await expect(api.exporterCv(cvCanned, 'pdf')).rejects.toMatchObject({ code: 'ecriture-impossible' })
  })

  it('transmet les paramètres et la clé au fabricant de fournisseur', async () => {
    const { api, lireRecu } = service()
    await api.definirCleApi('sk-abc')
    await api.importerCv()
    expect(lireRecu()?.cle).toBe('sk-abc')
  })
})

describe('lireCv', () => {
  it('refuse ce qui n’est ni un PDF ni un DOCX, sans lire le fichier', async () => {
    const chemin = join(dossier, 'secret.txt')
    await writeFile(chemin, 'contenu privé')
    await expect(lireCv(chemin)).rejects.toMatchObject({ code: 'fichier-illisible' })
    await expect(lireCv('C:\\Windows\\System32\\cmd.exe')).rejects.toMatchObject({ code: 'fichier-illisible' })
  })

  it('signale un fichier introuvable ou illisible avec le même code', async () => {
    await expect(lireCv(join(dossier, 'absent.pdf'))).rejects.toMatchObject({ code: 'fichier-illisible' })
    const faux = join(dossier, 'faux.docx')
    await writeFile(faux, 'ceci n’est pas un document Word')
    await expect(lireCv(faux)).rejects.toMatchObject({ code: 'fichier-illisible' })
  })
})
