import type { Offre } from '../schemas/offre'
import { extraireOffreDepuisHtml } from './extraction'

export type CodeErreurOffre = 'url-invalide' | 'reseau' | 'http' | 'contenu-non-html' | 'contenu-vide'

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
}

const MESSAGE_COLLER = 'Impossible de récupérer cette offre automatiquement. Colle le texte de l’offre à la place.'

function validerUrl(brute: string): URL {
  try {
    const url = new URL(brute.trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') return url
  } catch {
    // tombe sur l'erreur ci-dessous
  }
  throw new ErreurRecuperationOffre('url-invalide', 'Adresse invalide : une URL http(s) est attendue.')
}

async function telechargerHtml(url: URL, fetchImpl: typeof fetch, delaiMs: number): Promise<string> {
  let reponse: Response
  try {
    reponse = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(delaiMs),
      headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'fr,en;q=0.8' },
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
  return reponse.text()
}

/**
 * Récupère une offre depuis une URL : `fetch` + Readability, puis repli
 * par rendu navigateur si la page est vide. Lève toujours `ErreurRecuperationOffre`.
 */
export async function recupererOffre(urlBrute: string, options: OptionsRecuperation = {}): Promise<Offre> {
  const { fetchImpl = fetch, rendreHtml, delaiMs = 15_000 } = options
  const url = validerUrl(urlBrute)

  let erreurFetch: ErreurRecuperationOffre | undefined
  try {
    const offre = extraireOffreDepuisHtml(await telechargerHtml(url, fetchImpl, delaiMs))
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

  throw erreurFetch ?? new ErreurRecuperationOffre('contenu-vide', `${MESSAGE_COLLER} (aucun texte trouvé sur la page)`)
}
