import { type RefObject, useLayoutEffect, useState } from 'react'

/**
 * Scale that fits a page of `pageWidth` CSS pixels into the width of `container`, kept up to date when the container
 * is resized. `max` caps it (1: never larger than the real size).
 */
export function useScaleToWidth(
  container: RefObject<HTMLElement | null>,
  pageWidth: number,
  { initial, max = Number.POSITIVE_INFINITY }: { initial: number; max?: number },
): number {
  const [scale, setScale] = useState(initial)

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = () => setScale(Math.min(max, element.clientWidth / pageWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [container, pageWidth, max])

  return scale
}
