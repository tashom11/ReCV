import { describe, expect, it } from 'vitest'
import { extractJobPostingFromHtml } from './extraction'
import { extractStructuredJobPosting } from './structuredData'
import { cleanJobPostingText, htmlToText, prepareJobPostingText } from './text'

describe('htmlVersTexte', () => {
  it('sépare les blocs au lieu de les coller, et met les puces sur une ligne', () => {
    const text = htmlToText('<p>Premier bloc</p><p>Deuxième</p><ul><li><p>Tâche A</p></li><li>Tâche B</li></ul>')
    expect(text).toBe('Premier bloc\n\nDeuxième\n\n- Tâche A\n- Tâche B')
  })

  it('ignore scripts et styles', () => {
    expect(htmlToText('<p>Texte</p><script>alert(1)</script><style>p{}</style>')).toBe('Texte')
  })
})

describe('nettoyerTexteOffre', () => {
  const jobPosting = [
    'Missions',
    '- Animer les réseaux sociaux',
    '',
    'Déroulement des entretiens',
    'Premier échange visio (~30 min)',
    'Entretien final (~30 min)',
    '',
    'Profil recherché',
    '- LinkedIn indispensable',
    '',
    '❄️Pourquoi nous rejoindre ?',
    'Des séminaires, des bureaux partout.',
    '',
    'Envie d’en savoir plus ?',
    'Rencontrez Lou, Directeur SEO',
    '',
    'Cette annonce est rédigée au masculin pour des raisons de lisibilité.',
  ].join('\n')

  it('retire déroulé d’entretiens, argumentaire employeur et mentions standard, garde missions et profil', () => {
    const cleaned = cleanJobPostingText(jobPosting)
    expect(cleaned).toContain('Animer les réseaux sociaux')
    expect(cleaned).toContain('LinkedIn indispensable')
    expect(cleaned).not.toMatch(/entretien|séminaires|Rencontrez|masculin/i)
  })

  it('plafonne la longueur à une limite de ligne', () => {
    const long = Array.from({ length: 400 }, (_, i) => `- Mission numéro ${i} de l’offre`).join('\n')
    const prepared = prepareJobPostingText(long, 1000)
    expect(prepared.length).toBeLessThanOrEqual(1000)
    expect(prepared.endsWith('de l’offre')).toBe(true)
  })
})

const HTML_JOB_POSTING = `<html><head><title>Offre</title>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Consultant SEO',
  hiringOrganization: { '@type': 'Organization', name: 'Eskimoz' },
  jobLocation: [{ '@type': 'Place', address: { addressLocality: 'Lyon' } }],
  description: `<p>${'Piloter la visibilité du client au quotidien. '.repeat(8)}</p><ul><li>Auditer</li><li>Mesurer</li></ul>`,
})}</script></head><body><div id="app"></div></body></html>`

describe('données structurées JobPosting', () => {
  it('lit intitulé, entreprise, lieu et description structurée', () => {
    const o = extractStructuredJobPosting(HTML_JOB_POSTING)
    expect(o).toMatchObject({ title: 'Consultant SEO', company: 'Eskimoz', location: 'Lyon' })
    expect(o?.description).toContain('- Auditer\n- Mesurer')
  })

  it('est utilisée en priorité par l’extraction de page', () => {
    const jobPosting = extractJobPostingFromHtml(HTML_JOB_POSTING)
    expect(jobPosting).toMatchObject({ jobTitle: 'Consultant SEO', company: 'Eskimoz', location: 'Lyon' })
  })

  it('ignore un JSON-LD invalide ou d’un autre type', () => {
    const html =
      '<script type="application/ld+json">{pas du json</script><script type="application/ld+json">{"@type":"FAQPage"}</script>'
    expect(extractStructuredJobPosting(html)).toBeNull()
  })
})
