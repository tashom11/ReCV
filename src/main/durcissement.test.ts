import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CANAUX, estServiceLocal, parametresSchema, type ResultatIpc } from '@core/api'
import { ErreurCodee } from '@core/erreurs'
import { type FournisseurLLM, FournisseurMock } from '@core/llm'
import { profilSchema } from '@core/schemas'
import type { IpcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ouvrirBdd } from './bdd/connexion'
import { creerProfil, effacerDonnees } from './bdd/depots'
import { enregistrerHandlers } from './ipc'
import { GestionnaireModeles } from './modeles/gestionnaire'
import { type Chiffreur, StockageParametres } from './parametres'
import { creerService } from './service'

const chiffreur: Chiffreur = {
  disponible: () => true,
  chiffrer: (t) => Buffer.from(t, 'utf8').reverse(),
  dechiffrer: (b) => Buffer.from(b).reverse().toString('utf8'),
}

let dossier: string
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'recv-dur-'))
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

const existe = (chemin: string) =>
  stat(chemin).then(
    () => true,
    () => false,
  )

describe('erasing personal data', () => {
  it('leaves no trace of the profile in the database files, journal included', async () => {
    const chemin = join(dossier, 'recv.db')
    const bdd = ouvrirBdd(chemin)
    try {
      creerProfil(bdd, profilSchema.parse({ nom: 'Zoé Trace-Unique', experiences: [] }))
      effacerDonnees(bdd)
      for (const fichier of [chemin, `${chemin}-wal`]) {
        if (!(await existe(fichier))) continue
        expect((await readFile(fichier)).includes('Trace-Unique'), fichier).toBe(false)
      }
    } finally {
      bdd.fermer()
    }
  })
})

describe('validation des URLs de service', () => {
  it('exige https pour l’API, sauf pour localhost', () => {
    expect(parametresSchema.safeParse({ urlApi: 'https://api.mistral.ai/v1' }).success).toBe(true)
    expect(parametresSchema.safeParse({ urlApi: 'http://localhost:8080/v1' }).success).toBe(true)
    expect(parametresSchema.safeParse({ urlApi: 'http://attaquant.example/v1' }).success).toBe(false)
    expect(parametresSchema.safeParse({ urlApi: 'ftp://exemple.fr' }).success).toBe(false)
    expect(parametresSchema.safeParse({ urlApi: 'https://user:mdp@exemple.fr' }).success).toBe(false)
    expect(parametresSchema.safeParse({ urlOllama: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('tells whether a service runs on this computer (the CV does not leave it)', () => {
    expect(estServiceLocal('http://localhost:11434/v1')).toBe(true)
    expect(estServiceLocal('http://127.0.0.1:11434/v1')).toBe(true)
    expect(estServiceLocal('http://[::1]:11434/v1')).toBe(true)
    expect(estServiceLocal('http://192.168.1.20:11434/v1')).toBe(false)
    expect(estServiceLocal('https://ollama.example.com/v1')).toBe(false)
    expect(estServiceLocal('pas une url')).toBe(false)
  })

  it('n’accepte qu’un fichier .gguf comme modèle local', () => {
    expect(parametresSchema.safeParse({ cheminModeleLocal: 'C:\\modeles\\a.GGUF' }).success).toBe(true)
    expect(parametresSchema.safeParse({ cheminModeleLocal: 'C:\\Windows\\system32\\cmd.exe' }).success).toBe(false)
  })
})

describe('clé API liée à sa destination', () => {
  it('supprime la clé quand l’origine de l’API change, la garde sinon', async () => {
    const stockage = new StockageParametres(dossier, chiffreur)
    const base = await stockage.lire()
    await stockage.enregistrer({ ...base, urlApi: 'https://api.mistral.ai/v1' })
    await stockage.definirCle('sk-secret')

    // Même origine, chemin différent : la clé reste.
    const memeOrigine = await stockage.enregistrer({ ...base, urlApi: 'https://api.mistral.ai/v2' })
    expect(memeOrigine.cleApiDefinie).toBe(true)

    // Autre origine : la clé est supprimée.
    const autre = await stockage.enregistrer({ ...base, urlApi: 'https://api.openai.com/v1' })
    expect(autre.cleApiDefinie).toBe(false)
    expect(await stockage.lireCle()).toBeNull()
  })
})

describe('service : cycle de vie du fournisseur et données', () => {
  function creer() {
    const bdd = ouvrirBdd(':memory:')
    const parametres = new StockageParametres(dossier, chiffreur)
    const appels: string[] = []
    let liberes = 0
    const service = creerService({
      bdd,
      parametres,
      modeles: new GestionnaireModeles({
        dossier: join(dossier, 'modeles'),
        ressources: async () => ({ ramGo: 8, vramGo: 0 }),
        emettre: () => undefined,
      }),
      choisirEtLireCv: async () => ({ texte: 'cv', nom: 'mon-cv.pdf' }),
      misesAJour: {
        etat: () => ({ version: '0.0.0', etat: 'indisponible' as const }),
        verifier: async () => ({ version: '0.0.0', etat: 'indisponible' as const }),
        installer: () => undefined,
      },
      lireCv: async () => 'cv',
      ouvrirChemin: async () => undefined,
      montrerChemin: () => undefined,
      rendreHtml: async () => '',
      choisirDestination: async () => null,
      genererPdf: async () => Buffer.alloc(0),
      creerFournisseur: async (p) => {
        appels.push(p.modeleOllama)
        const mock = new FournisseurMock()
        const fournisseur: FournisseurLLM = {
          extraireProfil: (t) => mock.extraireProfil(t),
          extraireOffre: (t) => mock.extraireOffre(t),
          analyserOffre: (o) => mock.analyserOffre(o),
          adapterCv: (pr, o) => mock.adapterCv(pr, o),
          genererAccroche: (pr) => mock.genererAccroche(pr),
          liberer: async () => void liberes++,
        }
        return fournisseur
      },
    })
    return { service, parametres, bdd, appels, liberes: () => liberes }
  }

  it('réutilise le fournisseur tant que les paramètres ne changent pas, puis le libère', async () => {
    const { service, parametres, appels, liberes } = creer()
    await service.importerCv()
    await service.analyserTexteOffre('offre')
    await service.analyserTexteOffre('offre')
    expect(appels).toHaveLength(1)

    await parametres.enregistrer({ ...(await parametres.lire()), modeleOllama: 'autre-modele' })
    await service.analyserTexteOffre('offre')
    expect(appels).toEqual(['qwen3:8b', 'autre-modele'])
    expect(liberes()).toBe(1)

    await service.liberer()
    expect(liberes()).toBe(2)
  })

  it('importer un CV crée un nouveau profil sans écraser le précédent', async () => {
    const { service } = creer()
    const premier = await service.importerCv()
    const second = await service.importerCv()
    expect(second?.id).not.toBe(premier?.id)
    expect((await service.obtenirProfil())?.id).toBe(second?.id)
  })

  it('efface profils, offres, CV et clé API', async () => {
    const { service, parametres } = creer()
    await service.importerCv()
    await service.adapterCv({ titrePoste: 'Dev', texteBrut: 'x' })
    await service.definirCleApi('sk-abc')

    await service.effacerDonnees()
    expect(await service.obtenirProfil()).toBeNull()
    expect(await parametres.lireCle()).toBeNull()
    expect(await existe(join(dossier, 'cle-api.bin'))).toBe(false)
  })
})

describe('handlers IPC', () => {
  type Handler = (evenement: { senderFrame?: { url: string } }, ...args: unknown[]) => Promise<ResultatIpc<unknown>>

  function branche(autorise: (url: string) => boolean) {
    const handlers = new Map<string, Handler>()
    const ipcMain = { handle: (canal: string, h: Handler) => void handlers.set(canal, h) } as unknown as IpcMain
    const appelees: string[] = []
    const api = new Proxy(
      {},
      {
        get:
          (_cible, nom) =>
          async (...args: unknown[]) => {
            appelees.push(`${String(nom)}:${JSON.stringify(args)}`)
            return null
          },
      },
    )
    enregistrerHandlers(ipcMain, api as never, autorise)
    return { handlers, appelees }
  }

  it('refuse un appel dont la frame n’est pas l’interface de l’application', async () => {
    const { handlers, appelees } = branche((url) => url.startsWith('file://'))
    const h = handlers.get(CANAUX.obtenirProfil)
    const refuse = await h?.({ senderFrame: { url: 'https://evil.example/' } })
    expect(refuse).toMatchObject({ ok: false, message: 'Appel IPC refusé.' })
    expect(appelees).toHaveLength(0)

    const accepte = await h?.({ senderFrame: { url: 'file:///app/index.html' } })
    expect(accepte).toEqual({ ok: true, valeur: null })
  })

  it('refuse des paramètres invalides avant d’appeler le service', async () => {
    const { handlers, appelees } = branche(() => true)
    const resultat = await handlers.get(CANAUX.enregistrerParametres)?.({}, { urlApi: 'http://attaquant.example' })
    expect(resultat?.ok).toBe(false)
    expect(appelees).toHaveLength(0)
  })

  it('transmet le code des erreurs que l’interface distingue', async () => {
    const handlers = new Map<string, Handler>()
    const ipcMain = { handle: (canal: string, h: Handler) => void handlers.set(canal, h) } as unknown as IpcMain
    const api = {
      annulerAdaptation: async () => {
        throw new ErreurCodee('annule', 'Création annulée.')
      },
    }
    enregistrerHandlers(ipcMain, api as never)
    expect(await handlers.get(CANAUX.annulerAdaptation)?.({})).toEqual({
      ok: false,
      message: 'Création annulée.',
      code: 'annule',
    })
  })

  it('refuse un chemin de fichier vide ou démesuré', async () => {
    const { handlers, appelees } = branche(() => true)
    expect((await handlers.get(CANAUX.ouvrirFichier)?.({}, ''))?.ok).toBe(false)
    expect((await handlers.get(CANAUX.importerCvDepose)?.({}, 'x'.repeat(5_000)))?.ok).toBe(false)
    expect((await handlers.get(CANAUX.montrerDansDossier)?.({}, { chemin: 'objet' }))?.ok).toBe(false)
    expect(appelees).toHaveLength(0)
  })

  it('refuse un profil démesuré', async () => {
    const { handlers, appelees } = branche(() => true)
    const enorme = { competences: Array.from({ length: 20_000 }, (_, i) => `compétence numéro ${i} ${'x'.repeat(20)}`) }
    const resultat = await handlers.get(CANAUX.enregistrerProfil)?.({}, enorme)
    expect(resultat?.ok).toBe(false)
    expect(appelees).toHaveLength(0)
  })
})
