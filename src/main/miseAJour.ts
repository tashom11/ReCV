import type { EtatMiseAJour } from '@core/api'

/** Ce que le gestionnaire attend d'`electron-updater` (injectable pour les tests). */
export interface MoteurMiseAJour {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  /** Vérifie les releases ; télécharge la nouvelle version s'il y en a une et prévient par une notification. */
  checkForUpdatesAndNotify(): Promise<unknown>
  quitAndInstall(): void
  on(evenement: string, rappel: (...args: never[]) => void): unknown
}

export interface DependancesMiseAJour {
  /** Version de l'application en cours d'exécution. */
  version: string
  /** Faux en développement : il n'y a alors rien à mettre à jour. */
  installee: boolean
  moteur: () => MoteurMiseAJour
  emettre: (etat: EtatMiseAJour) => void
  /** Délai entre deux vérifications tant que l'application reste ouverte. */
  intervalleMs?: number
}

// Une application laissée ouverte plusieurs jours doit quand même apprendre qu'une version est sortie.
const INTERVALLE_DEFAUT_MS = 6 * 60 * 60 * 1000

/**
 * Suit les mises à jour (releases GitHub) : vérification au démarrage, puis à intervalle régulier et à la demande.
 * Chaque changement d'état est transmis à l'interface, erreurs comprises : un dépôt inaccessible ou une coupure
 * de connexion ne gênent pas l'usage, mais ne passent plus sous silence.
 */
export class GestionnaireMiseAJour {
  private courant: EtatMiseAJour
  private minuteur: ReturnType<typeof setInterval> | null = null
  private moteur: MoteurMiseAJour | null = null

  constructor(private readonly deps: DependancesMiseAJour) {
    this.courant = { version: deps.version, etat: deps.installee ? 'inactif' : 'indisponible' }
  }

  etat(): EtatMiseAJour {
    return this.courant
  }

  private changer(partiel: Partial<EtatMiseAJour>): void {
    this.courant = { ...this.courant, ...partiel }
    this.deps.emettre(this.courant)
  }

  /** Branche le moteur, lance la première vérification et programme les suivantes. */
  demarrer(): void {
    if (!this.deps.installee || this.moteur) return
    const moteur = this.deps.moteur()
    this.moteur = moteur
    moteur.autoDownload = true
    moteur.autoInstallOnAppQuit = true
    moteur.on('checking-for-update', () => {
      // Une version déjà prête le reste : la vérification suivante ne doit pas l'effacer de l'écran.
      if (this.courant.etat !== 'prete') this.changer({ etat: 'verification', message: undefined })
    })
    moteur.on('update-not-available', () => this.changer({ etat: 'a-jour', verifieLe: Date.now() }))
    moteur.on('update-available', (info: { version: string }) =>
      this.changer({ etat: 'telechargement', nouvelleVersion: info.version, pourcentage: 0 }),
    )
    moteur.on('download-progress', (progression: { percent: number }) =>
      this.changer({ etat: 'telechargement', pourcentage: Math.round(progression.percent) }),
    )
    moteur.on('update-downloaded', (info: { version: string }) =>
      this.changer({ etat: 'prete', nouvelleVersion: info.version, pourcentage: 100, verifieLe: Date.now() }),
    )
    moteur.on('error', (erreur: Error) => this.echec(erreur))

    void this.verifier()
    this.minuteur = setInterval(() => void this.verifier(), this.deps.intervalleMs ?? INTERVALLE_DEFAUT_MS)
    // Le minuteur ne doit pas retenir l'application ouverte.
    this.minuteur.unref?.()
  }

  private echec(erreur: unknown): void {
    if (this.courant.etat === 'prete') return
    this.changer({ etat: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
  }

  /** Vérifie maintenant. Sans effet pendant une vérification ou un téléchargement, ou si une version est prête. */
  async verifier(): Promise<EtatMiseAJour> {
    const { etat } = this.courant
    if (!this.moteur || etat === 'verification' || etat === 'telechargement' || etat === 'prete') return this.courant
    try {
      await this.moteur.checkForUpdatesAndNotify()
    } catch (erreur) {
      this.echec(erreur)
    }
    return this.courant
  }

  /** Ferme l'application et installe la version téléchargée. */
  installer(): void {
    if (this.courant.etat !== 'prete' || !this.moteur) {
      throw new Error('Aucune mise à jour n’est prête à être installée.')
    }
    this.moteur.quitAndInstall()
  }

  arreter(): void {
    if (this.minuteur) clearInterval(this.minuteur)
    this.minuteur = null
  }
}
