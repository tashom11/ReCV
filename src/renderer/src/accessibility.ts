import type { Vue } from './parcours'

const TITLES: Record<Vue, string> = {
  accueil: '',
  preparation: 'Préparation',
  cv: 'Étape 1 sur 3 : mon CV',
  annonce: 'Étape 2 sur 3 : l’annonce',
  creation: 'Création de votre CV',
  resultat: 'Étape 3 sur 3 : mon nouveau CV',
  succes: 'CV téléchargé',
  reglages: 'Réglages',
}

/** Window title of a screen: the first thing a screen reader says when the screen changes (WCAG 2.4.2). */
export function windowTitle(view: Vue): string {
  return TITLES[view] ? `${TITLES[view]} — Re:CV` : 'Re:CV'
}

/** Text for a live region during a download: rounded down to the ten, so it changes rarely. */
export function downloadAnnouncement(percent: number, verifying: boolean): string {
  if (verifying) return 'Vérification du fichier'
  return `Téléchargement : ${Math.floor(percent / 10) * 10} %`
}

/** Moves the focus to the title of the visible screen, after a screen change (WCAG 2.4.3). */
export function focusScreenTitle(root: ParentNode = document): void {
  const title = [...root.querySelectorAll<HTMLHeadingElement>('main h1')].find((h1) => h1.checkVisibility())
  if (!title) return
  title.tabIndex = -1
  title.focus({ preventScroll: true })
}
