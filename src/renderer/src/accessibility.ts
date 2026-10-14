import type { View } from './flow'

const TITLES: Record<View, string> = {
  welcome: '',
  setup: 'Préparation',
  cv: 'Étape 1 sur 3 : mon CV',
  posting: 'Étape 2 sur 3 : l’annonce',
  generating: 'Création de votre CV',
  result: 'Étape 3 sur 3 : mon nouveau CV',
  success: 'CV téléchargé',
  settings: 'Réglages',
}

/** Window title of a screen: the first thing a screen reader says when the screen changes (WCAG 2.4.2). */
export function windowTitle(view: View): string {
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
