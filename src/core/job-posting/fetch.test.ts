import { describe, expect, it, vi } from 'vitest'
import { extractJobPostingFromHtml } from './extraction'
import { fetchJobPosting, JobPostingFetchError } from './fetch'

const PARAGRAPH =
  'Nous recherchons un développeur confirmé pour rejoindre notre équipe produit, travailler en TypeScript et React, et participer à la conception de nos outils internes. '

const JOB_POSTING_HTML = `<!doctype html><html><head>
<title>Développeur React — Acme</title>
<meta property="og:site_name" content="Acme">
</head><body>
<nav>Accueil | Offres | Contact</nav>
<article><h1>Développeur React</h1>
<p>${PARAGRAPH}</p><p>${PARAGRAPH}</p>
<ul><li>TypeScript</li><li>React</li></ul></article>
<footer>© Acme</footer></body></html>`

const EMPTY_JS_HTML = `<!doctype html><html><head><title>Offres</title></head>
<body><div id="root"></div><script>window.app()</script></body></html>`

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init })
}

describe('extractJobPostingFromHtml', () => {
  it('extracts the title, the company and the main text', () => {
    const jobPosting = extractJobPostingFromHtml(JOB_POSTING_HTML)
    expect(jobPosting).not.toBeNull()
    expect(jobPosting?.jobTitle).toContain('Développeur React')
    expect(jobPosting?.company).toBe('Acme')
    expect(jobPosting?.rawText).toContain('TypeScript et React')
  })

  it('returns null for a page without content (rendered in JS)', () => {
    expect(extractJobPostingFromHtml(EMPTY_JS_HTML)).toBeNull()
  })
})

describe('fetchJobPosting', () => {
  it('rejects an invalid or non-http(s) URL', async () => {
    await expect(fetchJobPosting('pas une url')).rejects.toMatchObject({ code: 'invalid-url' })
    await expect(fetchJobPosting('file:///etc/passwd')).rejects.toMatchObject({ code: 'invalid-url' })
  })

  it('refuses addresses of the local network, without any request', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(JOB_POSTING_HTML)) as unknown as typeof fetch
    const renderHtml = vi.fn(async () => JOB_POSTING_HTML)
    const localUrls = [
      'http://localhost:8080/admin',
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://192.168.1.1/',
      'http://10.0.0.5/',
      'http://172.16.4.2/',
      'http://169.254.169.254/latest/meta-data',
      'http://imprimante.local/',
      'http://[fd12::1]/',
      'http://0.0.0.0/',
    ]
    for (const url of localUrls) {
      await expect(fetchJobPosting(url, { fetchImpl, renderHtml }), url).rejects.toMatchObject({
        code: 'local-network',
      })
    }
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(renderHtml).not.toHaveBeenCalled()
  })

  it('accepts public addresses that merely look like private ones', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(JOB_POSTING_HTML)) as unknown as typeof fetch
    await expect(fetchJobPosting('https://172.32.0.1/offre', { fetchImpl })).resolves.toBeDefined()
    await expect(fetchJobPosting('https://localhost.example.com/offre', { fetchImpl })).resolves.toBeDefined()
  })

  it('retourne l’offre extraite via fetch', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(JOB_POSTING_HTML)) as unknown as typeof fetch
    const jobPosting = await fetchJobPosting('https://exemple.test/offre', { fetchImpl })
    expect(jobPosting.rawText).toContain('développeur confirmé')
  })

  it('uses browser rendering when the static page is empty', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(EMPTY_JS_HTML)) as unknown as typeof fetch
    const renderHtml = vi.fn(async () => JOB_POSTING_HTML)
    const jobPosting = await fetchJobPosting('https://exemple.test/offre', { fetchImpl, renderHtml })
    expect(renderHtml).toHaveBeenCalledWith('https://exemple.test/offre')
    expect(jobPosting.company).toBe('Acme')
  })

  it('throws a clear error if everything fails (empty page, failed fallback)', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(EMPTY_JS_HTML)) as unknown as typeof fetch
    const renderHtml = vi.fn(async () => {
      throw new Error('boom')
    })
    const promise = fetchJobPosting('https://exemple.test/offre', { fetchImpl, renderHtml })
    await expect(promise).rejects.toBeInstanceOf(JobPostingFetchError)
    await expect(promise).rejects.toMatchObject({ code: 'empty-content' })
    await expect(promise).rejects.toThrow(/Collez le texte/)
  })

  it('reports an HTTP error and still tries the fallback', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('', { status: 403 })) as unknown as typeof fetch
    const renderHtml = vi.fn(async () => JOB_POSTING_HTML)
    const jobPosting = await fetchJobPosting('https://exemple.test/offre', { fetchImpl, renderHtml })
    expect(jobPosting.jobTitle).toContain('Développeur')

    await expect(fetchJobPosting('https://exemple.test/offre', { fetchImpl })).rejects.toMatchObject({
      code: 'http',
    })
  })

  it('clearly explains that a protected site (Indeed, LinkedIn…) requires pasting the text', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('', { status: 403 })) as unknown as typeof fetch
    const renderHtml = vi.fn(async () => EMPTY_JS_HTML)
    for (const url of ['https://fr.indeed.com/viewjob?jk=abc', 'https://www.linkedin.com/jobs/view/1']) {
      await expect(fetchJobPosting(url, { fetchImpl, renderHtml })).rejects.toMatchObject({
        code: 'protected-site',
        message: expect.stringMatching(/protège ses pages.*collez-le ici/),
      })
    }
  })

  it('does not mistake an ordinary site for a protected one', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('', { status: 403 })) as unknown as typeof fetch
    await expect(fetchJobPosting('https://exemple-indeedlike.test/offre', { fetchImpl })).rejects.toMatchObject({
      code: 'http',
    })
  })

  it('reports a network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(fetchJobPosting('https://exemple.test/x', { fetchImpl })).rejects.toMatchObject({
      code: 'network',
    })
  })

  it('refuses non-HTML content', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    ) as unknown as typeof fetch
    await expect(fetchJobPosting('https://exemple.test/a.pdf', { fetchImpl })).rejects.toMatchObject({
      code: 'not-html',
    })
  })
})
