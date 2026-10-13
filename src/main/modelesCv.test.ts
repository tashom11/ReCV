import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FournisseurMock, profilCanned } from '@core/llm'
import { cvAdapteSchema } from '@core/schemas'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ouvrirBdd } from './bdd/connexion'
import { GestionnaireModeles } from './modeles/gestionnaire'
import { StockageParametres } from './parametres'
import { creerService } from './service'

const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let dossier: string
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'recv-mod-'))
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

function creer() {
  const parametres = new StockageParametres(dossier, {
    disponible: () => true,
    chiffrer: (t) => Buffer.from(t),
    dechiffrer: (b) => b.toString(),
  })
  const pdfs: string[] = []
  const service = creerService({
    bdd: ouvrirBdd(':memory:'),
    parametres,
    modeles: new GestionnaireModeles({
      dossier: join(dossier, 'modeles'),
      ressources: async () => ({ ramGo: 8, vramGo: 0 }),
      emettre: () => undefined,
    }),
    choisirEtLireCv: async () => ({ texte: 'cv', nom: 'mon-cv.pdf' }),
    lireCv: async () => 'cv',
    ouvrirChemin: async () => undefined,
    montrerChemin: () => undefined,
    rendreHtml: async () => '',
    choisirDestination: async (nom, extension) => join(dossier, nom.replace(/\.\w+$/, `.${extension}`)),
    genererPdf: async (html) => {
      pdfs.push(html)
      return Buffer.from('%PDF-fake')
    },
    creerFournisseur: async () => new FournisseurMock(),
  })
  return { service, parametres, pdfs }
}

const cv = cvAdapteSchema.parse({ titre: 'Dev', accroche: 'Je fais preuve de rigueur.' })

describe('modèles de CV et photo', () => {
  it('renvoie le HTML d’un modèle avec la photo du profil', async () => {
    const { service } = creer()
    await service.enregistrerProfil({ ...profilCanned, photo: PHOTO })
    const html = await service.htmlModeleCv(cv, 'elegant')
    expect(html).toContain('data-modele="elegant"')
    expect(html).toContain('<img class="photo"')
  })

  it('exporte avec le modèle demandé, à défaut avec celui des paramètres', async () => {
    const { service, parametres, pdfs } = creer()
    await service.enregistrerProfil(profilCanned)

    await service.exporterCv(cv, 'pdf', 'bandeau')
    expect(pdfs.at(-1)).toContain('data-modele="bandeau"')

    await parametres.enregistrer({ ...(await parametres.lire()), modeleCv: 'moderne' })
    await service.exporterCv(cv, 'pdf')
    expect(pdfs.at(-1)).toContain('data-modele="moderne"')
  })

  it('importer un autre CV conserve la photo du profil actif', async () => {
    const { service } = creer()
    await service.enregistrerProfil({ ...profilCanned, photo: PHOTO })
    const importe = await service.importerCv()
    expect(importe?.profil.photo).toBe(PHOTO)
  })
})
