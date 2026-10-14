import type { View } from './flow'
import { texts } from './i18n'

/** Window title of a screen: the first thing a screen reader says when the screen changes (WCAG 2.4.2). */
export function windowTitle(view: View): string {
  const screen = texts.windowTitles[view]
  return screen ? texts.windowTitle(screen) : texts.appName
}

/** Text for a live region during a download: rounded down to the ten, so it changes rarely. */
export function downloadAnnouncement(percent: number, verifying: boolean): string {
  if (verifying) return texts.download.verifying
  return texts.download.announcement(Math.floor(percent / 10) * 10)
}

/** Moves the focus to the title of the visible screen, after a screen change (WCAG 2.4.3). */
export function focusScreenTitle(root: ParentNode = document): void {
  const title = [...root.querySelectorAll<HTMLHeadingElement>('main h1')].find((h1) => h1.checkVisibility())
  if (!title) return
  title.tabIndex = -1
  title.focus({ preventScroll: true })
}
