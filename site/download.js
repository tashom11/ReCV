// Fills the download buttons with the installer of the latest GitHub release. Without JavaScript, or if the request
// fails, the buttons keep pointing to the releases page: nothing is lost. No cookie, no tracking.
const REPO = 'tashom11/ReCV'
const RELEASES = `https://github.com/${REPO}/releases/latest`

const formatSize = (bytes) => `${Math.round(bytes / 1_048_576)} Mo`
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

async function latestInstaller() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`GitHub: ${response.status}`)
  const release = await response.json()
  const installer = (release.assets ?? []).find((asset) => /\.exe$/i.test(asset.name))
  if (!installer) throw new Error('No installer in the latest release')
  return { release, installer }
}

for (const link of document.querySelectorAll('[data-download-link]')) {
  link.setAttribute('href', RELEASES)
}

latestInstaller().then(
  ({ release, installer }) => {
    const version = String(release.tag_name ?? '').replace(/^v/, '')
    for (const link of document.querySelectorAll('[data-download-link]')) {
      link.setAttribute('href', installer.browser_download_url)
    }
    for (const element of document.querySelectorAll('[data-download-meta]')) {
      element.textContent = `Version ${version} · ${formatSize(installer.size)} · Windows 10 et 11 · gratuit`
    }
    for (const element of document.querySelectorAll('[data-download-details]')) {
      const published = release.published_at ? ` du ${formatDate(release.published_at)}` : ''
      element.textContent = `Version ${version}${published} · ${formatSize(installer.size)} · Windows 10 et 11`
    }
  },
  () => undefined,
)
