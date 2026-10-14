import { describe, expect, it } from 'vitest'
import { extractJobPostingFromHtml } from './extraction'
import { extractStructuredJobPosting } from './structuredData'
import { cleanJobPostingText, htmlToText, prepareJobPostingText } from './text'

describe('htmlToText', () => {
  it('separates blocks instead of gluing them, and keeps bullets on one line', () => {
    const text = htmlToText('<p>Premier bloc</p><p>Deuxième</p><ul><li><p>Tâche A</p></li><li>Tâche B</li></ul>')
    expect(text).toBe('Premier bloc\n\nDeuxième\n\n- Tâche A\n- Tâche B')
  })

  it('ignores scripts and styles', () => {
    expect(htmlToText('<p>Texte</p><script>alert(1)</script><style>p{}</style>')).toBe('Texte')
  })
})

describe('cleanJobPostingText', () => {
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

  it('removes interview process, employer pitch and standard notices, keeps missions and profile', () => {
    const cleaned = cleanJobPostingText(jobPosting)
    expect(cleaned).toContain('Animer les réseaux sociaux')
    expect(cleaned).toContain('LinkedIn indispensable')
    expect(cleaned).not.toMatch(/entretien|séminaires|Rencontrez|masculin/i)
  })

  it('caps the length at a line boundary', () => {
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

describe('JobPosting structured data', () => {
  it('reads title, company, location and structured description', () => {
    const o = extractStructuredJobPosting(HTML_JOB_POSTING)
    expect(o).toMatchObject({ title: 'Consultant SEO', company: 'Eskimoz', location: 'Lyon' })
    expect(o?.description).toContain('- Auditer\n- Mesurer')
  })

  it('is used first by the page extraction', () => {
    const jobPosting = extractJobPostingFromHtml(HTML_JOB_POSTING)
    expect(jobPosting).toMatchObject({ jobTitle: 'Consultant SEO', company: 'Eskimoz', location: 'Lyon' })
  })

  it('ignores invalid JSON-LD or JSON-LD of another type', () => {
    const html =
      '<script type="application/ld+json">{pas du json</script><script type="application/ld+json">{"@type":"FAQPage"}</script>'
    expect(extractStructuredJobPosting(html)).toBeNull()
  })
})
