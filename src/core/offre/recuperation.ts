import type { Offre } from '../schemas/offre'
import { extraireOffreDepuisHtml } from './extraction'

export type CodeErreurOffre =
  | 'url-invalide'
  | 'reseau-local'
  | 'reseau'
  | 'http'
  | 'contenu-non-html'
  | 'contenu-vide'
  | 'site-protege'

// Sites qui servent un défi anti-robot ou exigent une connexion : inutile d'insister, on guide l'utilisateur.
const SITES_PROTEGES: { motif: RegExp; nom: string }[] = [
  { motif: /(^|\.)indeed\.[a-z.]+$/i, nom: 'Indeed' },
  { motif: /(^|\.)linkedin\.com$/i, nom: 'LinkedIn' },
  { motif: /(^|\.)glassdoor\.[a-z.]+$/i, nom: 'Glassdoor' },
]

function erreurSiteProtege(hote: string): ErreurRecuperationOffre | null {
  const site = SITES_PROTEGES.find((s) => s.motif.test(hote))
  if (!site) return null
  return new ErreurRecuperationOffre(
    'site-protege',
    `${site.nom} protège ses pages contre les accès automatiques : ouvrez l’annonce dans votre navigateur, copiez son texte, puis collez-le ici.`,
  )
}

/** Erreur claire : l'UI doit proposer à l'utilisateur de coller le texte de l'offre. */
export class ErreurRecuperationOffre extends Error {
  readonly code: CodeErreurOffre

  constructor(code: CodeErreurOffre, message: string) {
    super(message)
    this.name = 'ErreurRecuperationOffre'
    this.code = code
  }
}

export interface OptionsRecuperation {
  /** Injectable pour les tests (aucune requête réseau réelle). */
  fetchImpl?: typeof fetch
  /** Repli pour les pages rendues en JS : retourne le HTML après rendu (fourni par `src/main`). */
  rendreHtml?: (url: string) => Promise<string>
  delaiMs?: number
  /** User-Agent à présenter : beaucoup de sites refusent (401/403) l'agent par défaut de Node. */
  userAgent?: string
}

const MESSAGE_COLLER = 'Impossible de récupérer cette offre automatiquement. Collez le texte de l’annonce à la place.'

/**
 * Host of this computer or of the local network (router, printer, cloud metadata service…). A job posting is never
 * there, and the fallback window would run that page's JavaScript with access to the network.
 * Literal check only: a public name resolving to a private address is not detected.
 */
export function estHoteReseauLocal(hostname: string): boolean {
  const hote = hostname.toLowerCase().replace(/\.$/, '')
  if (hote === 'localhost' || hote.endsWith('.localhost') || hote.endsWith('.local')) return true
  if (hote.startsWith('[')) {
    const ipv6 = hote.slice(1, -1)
    return ipv6 === '::' || ipv6 === '::1' || /^(f[cd]|fe[89ab])/.test(ipv6) || ipv6.startsWith('::ffff:')
  }
  const octets = hote.split('.').map(Number)
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o))) return false
  const [a = -1, b = -1] = octets
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

function validerUrl(brute: string): URL {
  let url: URL | null = null
  try {
    url = new URL(brute.trim())
  } catch {
    // tombe sur l'erreur ci-dessous
  }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new ErreurRecuperationOffre('url-invalide', 'Adresse invalide : une URL http(s) est attendue.')
  }
  if (estHoteReseauLocal(url.hostname)) {
    throw new ErreurRecuperationOffre(
      'reseau-local',
      'Cette adresse désigne un appareil de votre ordinateur ou de votre réseau, pas une annonce en ligne.',
    )
  }
  return url
}

async function telechargerHtml(
  url: URL,
  fetchImpl: typeof fetch,
  delaiMs: number,
  userAgent?: string,
): Promise<string> {
  let reponse: Response
  try {
    reponse = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(delaiMs),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr,en;q=0.8',
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
    })
  } catch {
    throw new ErreurRecuperationOffre('reseau', `${MESSAGE_COLLER} (site injoignable)`)
  }
  if (!reponse.ok) {
    throw new ErreurRecuperationOffre('http', `${MESSAGE_COLLER} (le site a répondu ${reponse.status})`)
  }
  const type = reponse.headers.get('content-type') ?? ''
  if (type && !/html|xml/i.test(type)) {
    throw new ErreurRecuperationOffre('contenu-non-html', `${MESSAGE_COLLER} (contenu non HTML)`)
  }
  return lireTexteBorne(reponse)
}

/** Une page d'offre légitime pèse quelques centaines de Ko : au-delà, on refuse plutôt que de tout charger. */
export const TAILLE_MAX_PAGE_OCTETS = 5 * 1024 * 1024

async function lireTexteBorne(reponse: Response): Promise<string> {
  const trop = () => new ErreurRecuperationOffre('contenu-non-html', `${MESSAGE_COLLER} (page trop volumineuse)`)
  const annonce = Number(reponse.headers.get('content-length'))
  if (annonce > TAILLE_MAX_PAGE_OCTETS) throw trop()
  if (!reponse.body) return reponse.text()

  const lecteur = reponse.body.getReader()
  const morceaux: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) break
      total += value.byteLength
      if (total > TAILLE_MAX_PAGE_OCTETS) {
        await lecteur.cancel()
        throw trop()
      }
      morceaux.push(value)
    }
  } catch (e) {
    if (e instanceof ErreurRecuperationOffre) throw e
    throw new ErreurRecuperationOffre('reseau', `${MESSAGE_COLLER} (lecture interrompue)`)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

/**
 * Récupère une offre depuis une URL : `fetch` + Readability, puis repli
 * par rendu navigateur si la page est vide. Lève toujours `ErreurRecuperationOffre`.
 */
export async function recupererOffre(urlBrute: string, options: OptionsRecuperation = {}): Promise<Offre> {
  const { fetchImpl = fetch, rendreHtml, delaiMs = 15_000, userAgent } = options
  const url = validerUrl(urlBrute)

  let erreurFetch: ErreurRecuperationOffre | undefined
  try {
    const offre = extraireOffreDepuisHtml(await telechargerHtml(url, fetchImpl, delaiMs, userAgent))
    if (offre) return offre
  } catch (e) {
    if (!(e instanceof ErreurRecuperationOffre)) throw e
    erreurFetch = e
  }

  if (rendreHtml) {
    try {
      const offre = extraireOffreDepuisHtml(await rendreHtml(url.href))
      if (offre) return offre
    } catch {
      // le repli a échoué : on retombe sur l'erreur la plus parlante
    }
  }

  throw (
    erreurSiteProtege(url.hostname) ??
    erreurFetch ??
    new ErreurRecuperationOffre('contenu-vide', `${MESSAGE_COLLER} (aucun texte trouvé sur la page)`)
  )
}
