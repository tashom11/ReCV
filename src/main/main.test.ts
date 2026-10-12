import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Parametres } from '@core/api'
import { FournisseurMock, profilCanned } from '@core/llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ouvrirBdd } from './bdd/connexion'
import { enregistrerProfil, obtenirProfilActif } from './bdd/depots'
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
  function service() {
    const bdd = ouvrirBdd(':memory:')
    const parametres = new StockageParametres(dossier, chiffreurFactice())
    let recu: { parametres: Parametres; cle: string | null } | undefined
    const api = creerService({
      bdd,
      parametres,
      modeles: new GestionnaireModeles({
        dossier: join(dossier, 'modeles'),
        ressources: async () => ({ ramGo: 8, vramGo: 0 }),
        emettre: () => undefined,
      }),
      choisirEtLireCv: async () => 'texte du cv',
      rendreHtml: async () => '',
      choisirDestination: async (nom, extension) => join(dossier, nom.replace(/.w+$/, `.${extension}`)),
      genererPdf: async (html) => Buffer.from(`%PDF-fake ${html.length}`),
      creerFournisseur: async (p, cle) => {
        recu = { parametres: p, cle }
        return new FournisseurMock()
      },
    })
    return { api, bdd, lireRecu: () => recu }
  }

  it('importe un CV puis adapte à une offre et enregistre le résultat', async () => {
    const { api } = service()
    expect(await api.adapterCv({ titrePoste: 'Dev', texteBrut: 'x' }).catch((e: Error) => e.message)).toMatch(
      /importe d’abord/,
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
    await expect(api.exporterCv(cvCanned, 'pdf')).rejects.toThrow(/importe d’abord/)
    await api.importerCv()
    const pdf = await api.exporterCv(cvCanned, 'pdf')
    const docx = await api.exporterCv(cvCanned, 'docx')
    expect(pdf).toMatch(/CV-Claire-Dubois.pdf$/)
    expect((await readFile(pdf as string)).toString().startsWith('%PDF')).toBe(true)
    expect((await readFile(docx as string)).subarray(0, 2).toString()).toBe('PK')
  })

  it('transmet les paramètres et la clé au fabricant de fournisseur', async () => {
    const { api, lireRecu } = service()
    await api.definirCleApi('sk-abc')
    await api.importerCv()
    expect(lireRecu()?.cle).toBe('sk-abc')
  })
})
