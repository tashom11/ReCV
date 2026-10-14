import type { JobPosting } from '../schemas/jobPosting'
import { extractJobPostingFromHtml } from './extraction'

export type JobPostingErrorCode =
  | 'url-invalide'
  | 'reseau-local'
  | 'reseau'
  | 'http'
  | 'contenu-non-html'
  | 'contenu-vide'
  | 'site-protege'

// Sites qui servent un défi anti-robot ou exigent une connexion : inutile d'insister, on guide l'utilisateur.
const PROTECTED_SITES: { pattern: RegExp; name: string }[] = [
  { pattern: /(^|\.)indeed\.[a-z.]+$/i, name: 'Indeed' },
  { pattern: /(^|\.)linkedin\.com$/i, name: 'LinkedIn' },
  { pattern: /(^|\.)glassdoor\.[a-z.]+$/i, name: 'Glassdoor' },
]

function protectedSiteError(host: string): JobPostingFetchError | null {
  const site = PROTECTED_SITES.find((s) => s.pattern.test(host))
  if (!site) return null
  return new JobPostingFetchError(
    'site-protege',
    `${site.name} protège ses pages contre les accès automatiques : ouvrez l’annonce dans votre navigateur, copiez son texte, puis collez-le ici.`,
  )
}

/** Erreur claire : l'UI doit proposer à l'utilisateur de coller le texte de l'offre. */
export class JobPostingFetchError extends Error {
  readonly code: JobPostingErrorCode

  constructor(code: JobPostingErrorCode, message: string) {
    super(message)
    this.name = 'ErreurRecuperationOffre'
    this.code = code
  }
}

export interface FetchOptions {
  /** Injectable pour les tests (aucune requête réseau réelle). */
  fetchImpl?: typeof fetch
  /** Repli pour les pages rendues en JS : retourne le HTML après rendu (fourni par `src/main`). */
  renderHtml?: (url: string) => Promise<string>
  delaiMs?: number
  /** User-Agent à présenter : beaucoup de sites refusent (401/403) l'agent par défaut de Node. */
  userAgent?: string
}

const PASTE_TEXT_MESSAGE =
  'Impossible de récupérer cette offre automatiquement. Collez le texte de l’annonce à la place.'

/**
 * Host of this computer or of the local network (router, printer, cloud metadata service…). A job posting is never
 * there, and the fallback window would run that page's JavaScript with access to the network.
 * Literal check only: a public name resolving to a private address is not detected.
 */
export function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host.startsWith('[')) {
    const ipv6 = host.slice(1, -1)
    return ipv6 === '::' || ipv6 === '::1' || /^(f[cd]|fe[89ab])/.test(ipv6) || ipv6.startsWith('::ffff:')
  }
  const bytes = host.split('.').map(Number)
  if (bytes.length !== 4 || bytes.some((o) => !Number.isInteger(o))) return false
  const [a = -1, b = -1] = bytes
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

function validateUrl(raw: string): URL {
  let url: URL | null = null
  try {
    url = new URL(raw.trim())
  } catch {
    // tombe sur l'erreur ci-dessous
  }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new JobPostingFetchError('url-invalide', 'Adresse invalide : une URL http(s) est attendue.')
  }
  if (isLocalNetworkHost(url.hostname)) {
    throw new JobPostingFetchError(
      'reseau-local',
      'Cette adresse désigne un appareil de votre ordinateur ou de votre réseau, pas une annonce en ligne.',
    )
  }
  return url
}

async function downloadHtml(url: URL, fetchImpl: typeof fetch, delaiMs: number, userAgent?: string): Promise<string> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(delaiMs),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr,en;q=0.8',
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
    })
  } catch {
    throw new JobPostingFetchError('reseau', `${PASTE_TEXT_MESSAGE} (site injoignable)`)
  }
  if (!response.ok) {
    throw new JobPostingFetchError('http', `${PASTE_TEXT_MESSAGE} (le site a répondu ${response.status})`)
  }
  const type = response.headers.get('content-type') ?? ''
  if (type && !/html|xml/i.test(type)) {
    throw new JobPostingFetchError('contenu-non-html', `${PASTE_TEXT_MESSAGE} (contenu non HTML)`)
  }
  return readBoundedText(response)
}

/** Une page d'offre légitime pèse quelques centaines de Ko : au-delà, on refuse plutôt que de tout charger. */
export const MAX_PAGE_BYTES = 5 * 1024 * 1024

async function readBoundedText(response: Response): Promise<string> {
  const tooLarge = () => new JobPostingFetchError('contenu-non-html', `${PASTE_TEXT_MESSAGE} (page trop volumineuse)`)
  const posting = Number(response.headers.get('content-length'))
  if (posting > MAX_PAGE_BYTES) throw tooLarge()
  if (!response.body) return response.text()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_PAGE_BYTES) {
        await reader.cancel()
        throw tooLarge()
      }
      chunks.push(value)
    }
  } catch (e) {
    if (e instanceof JobPostingFetchError) throw e
    throw new JobPostingFetchError('reseau', `${PASTE_TEXT_MESSAGE} (lecture interrompue)`)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Récupère une offre depuis une URL : `fetch` + Readability, puis repli
 * par rendu navigateur si la page est vide. Lève toujours `ErreurRecuperationOffre`.
 */
export async function fetchJobPosting(rawUrl: string, options: FetchOptions = {}): Promise<JobPosting> {
  const { fetchImpl = fetch, renderHtml, delaiMs = 15_000, userAgent } = options
  const url = validateUrl(rawUrl)

  let fetchError: JobPostingFetchError | undefined
  try {
    const jobPosting = extractJobPostingFromHtml(await downloadHtml(url, fetchImpl, delaiMs, userAgent))
    if (jobPosting) return jobPosting
  } catch (e) {
    if (!(e instanceof JobPostingFetchError)) throw e
    fetchError = e
  }

  if (renderHtml) {
    try {
      const jobPosting = extractJobPostingFromHtml(await renderHtml(url.href))
      if (jobPosting) return jobPosting
    } catch {
      // le repli a échoué : on retombe sur l'erreur la plus parlante
    }
  }

  throw (
    protectedSiteError(url.hostname) ??
    fetchError ??
    new JobPostingFetchError('contenu-vide', `${PASTE_TEXT_MESSAGE} (aucun texte trouvé sur la page)`)
  )
}
