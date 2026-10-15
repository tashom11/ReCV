// Reveals the elements marked `data-reveal` as they scroll into view. Without JavaScript, with a browser that lacks
// IntersectionObserver, or for people who asked for less motion, nothing is hidden: the page stays fully readable.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if ('IntersectionObserver' in window && !reduced) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.replace('reveal-hidden', 'reveal-visible')
        observer.unobserve(entry.target)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
  )
  for (const element of document.querySelectorAll('[data-reveal]')) {
    element.classList.add('reveal-hidden')
    observer.observe(element)
  }
}
