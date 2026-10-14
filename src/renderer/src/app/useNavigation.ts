import { useCallback, useEffect, useRef, useState } from 'react'
import { focusScreenTitle, windowTitle } from '../accessibility'
import type { View } from '../flow'

/**
 * Current view of the application, and the view to go back to when leaving the settings or the setup.
 * Each screen change is announced: window title, then focus on the title of the new screen (the clicked button has
 * disappeared, the focus would otherwise fall back to the page).
 */
export function useNavigation() {
  const [view, setView] = useState<View | null>(null)
  const returnView = useRef<View>('welcome')
  const previousView = useRef<View | null>(null)

  useEffect(() => {
    if (view === null) return
    document.title = windowTitle(view)
    const isFirstScreen = previousView.current === null
    previousView.current = view
    // Effects run after the DOM is updated: the new title is already there. (No requestAnimationFrame: it is
    // paused while the window is minimised, which users are invited to do during long tasks.)
    if (!isFirstScreen) focusScreenTitle()
  }, [view])

  const goTo = useCallback((nextView: View) => {
    setView((currentView) => {
      if ((nextView === 'settings' || nextView === 'setup') && currentView && currentView !== nextView) {
        if (currentView !== 'settings' && currentView !== 'setup') returnView.current = currentView
      }
      return nextView
    })
    window.scrollTo({ top: 0 })
  }, [])

  /** Back from the settings or the setup: where the user was, or step ① after the welcome screen. */
  const goBack = useCallback(() => goTo(returnView.current === 'welcome' ? 'cv' : returnView.current), [goTo])

  return { view, setView, goTo, goBack, returnView }
}
