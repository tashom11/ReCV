import { describe, expect, it, vi } from 'vitest'
import { extraireOffreDepuisHtml } from './extraction'
import { ErreurRecuperationOffre, recupererOffre } from './recuperation'

const PARAGRAPHE =
  'Nous recherchons un développeur confirmé pour rejoindre notre équipe produit, travailler en TypeScript et React, et participer à la conception de nos outils internes. '

const HTML_OFFRE = `<!doctype html><html><head>
<title>Développeur React — Acme</title>
<meta property="og:site_name" content="Acme">
</head><body>
<nav>Accueil | Offres | Contact</nav>
<article><h1>Développeur React</h1>
<p>${PARAGRAPHE}</p><p>${PARAGRAPHE}</p>
<ul><li>TypeScript</li><li>React</li></ul></article>
<footer>© Acme</footer></body></html>`

const HTML_VIDE_JS = `<!doctype html><html><head><title>Offres</title></head>
<body><div id="root"></div><script>window.app()</script></body></html>`

function reponseHtml(corps: string, init: ResponseInit = {}): Response {
  return new Response(corps, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init })
}

describe('extraireOffreDepuisHtml', () => {
  it('extrait le titre, l’entreprise et le texte principal', () => {
    const offre = extraireOffreDepuisHtml(HTML_OFFRE)
    expect(offre).not.toBeNull()
    expect(offre?.titrePoste).toContain('Développeur React')
    expect(offre?.entreprise).toBe('Acme')
    expect(offre?.texteBrut).toContain('TypeScript et React')
  })

  it('retourne null pour une page sans contenu (rendue en JS)', () => {
    expect(extraireOffreDepuisHtml(HTML_VIDE_JS)).toBeNull()
  })
})

describe('recupererOffre', () => {
  it('rejette une URL invalide ou non http(s)', async () => {
    await expect(recupererOffre('pas une url')).rejects.toMatchObject({ code: 'url-invalide' })
    await expect(recupererOffre('file:///etc/passwd')).rejects.toMatchObject({ code: 'url-invalide' })
  })

  it('retourne l’offre extraite via fetch', async () => {
    const fetchImpl = vi.fn(async () => reponseHtml(HTML_OFFRE)) as unknown as typeof fetch
    const offre = await recupererOffre('https://exemple.test/offre', { fetchImpl })
    expect(offre.texteBrut).toContain('développeur confirmé')
  })

  it('utilise le rendu navigateur quand la page statique est vide', async () => {
    const fetchImpl = vi.fn(async () => reponseHtml(HTML_VIDE_JS)) as unknown as typeof fetch
    const rendreHtml = vi.fn(async () => HTML_OFFRE)
    const offre = await recupererOffre('https://exemple.test/offre', { fetchImpl, rendreHtml })
    expect(rendreHtml).toHaveBeenCalledWith('https://exemple.test/offre')
    expect(offre.entreprise).toBe('Acme')
  })

  it('lève une erreur claire si tout échoue (page vide, repli en échec)', async () => {
    const fetchImpl = vi.fn(async () => reponseHtml(HTML_VIDE_JS)) as unknown as typeof fetch
    const rendreHtml = vi.fn(async () => {
      throw new Error('boom')
    })
    const promesse = recupererOffre('https://exemple.test/offre', { fetchImpl, rendreHtml })
    await expect(promesse).rejects.toBeInstanceOf(ErreurRecuperationOffre)
    await expect(promesse).rejects.toMatchObject({ code: 'contenu-vide' })
    await expect(promesse).rejects.toThrow(/Colle le texte/)
  })

  it('signale une erreur HTTP et tente tout de même le repli', async () => {
    const fetchImpl = vi.fn(async () => reponseHtml('', { status: 403 })) as unknown as typeof fetch
    const rendreHtml = vi.fn(async () => HTML_OFFRE)
    const offre = await recupererOffre('https://exemple.test/offre', { fetchImpl, rendreHtml })
    expect(offre.titrePoste).toContain('Développeur')

    await expect(recupererOffre('https://exemple.test/offre', { fetchImpl })).rejects.toMatchObject({
      code: 'http',
    })
  })

  it('explique clairement qu’un site protégé (Indeed, LinkedIn…) demande de coller le texte', async () => {
    const fetchImpl = vi.fn(async () => reponseHtml('', { status: 403 })) as unknown as typeof fetch
    const rendreHtml = vi.fn(async () => HTML_VIDE_JS)
    for (const url of ['https://fr.indeed.com/viewjob?jk=abc', 'https://www.linkedin.com/jobs/view/1']) {
      await expect(recupererOffre(url, { fetchImpl, rendreHtml })).rejects.toMatchObject({
        code: 'site-protege',
        message: expect.stringMatching(/protège ses pages.*colle-le ici/),
      })
    }
  })

  it('ne confond pas un site quelconque avec un site protégé', async () => {
    const fetchImpl = vi.fn(async () => reponseHtml('', { status: 403 })) as unknown as typeof fetch
    await expect(recupererOffre('https://exemple-indeedlike.test/offre', { fetchImpl })).rejects.toMatchObject({
      code: 'http',
    })
  })

  it('signale une erreur réseau', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(recupererOffre('https://exemple.test/x', { fetchImpl })).rejects.toMatchObject({
      code: 'reseau',
    })
  })

  it('refuse un contenu non HTML', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    ) as unknown as typeof fetch
    await expect(recupererOffre('https://exemple.test/a.pdf', { fetchImpl })).rejects.toMatchObject({
      code: 'contenu-non-html',
    })
  })
})
