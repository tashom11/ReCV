import { describe, expect, it } from 'vitest'
import { findGutter, pageText, type TextPiece } from './layout'

// Piece of text at (x, y), 5 units per character, 10 units high.
const piece = (x: number, y: number, text: string): TextPiece => ({ text, x, y, width: 5 * text.length, height: 10 })

describe('pageText', () => {
  it('joins the pieces of a line and starts a paragraph after a larger gap', () => {
    const text = pageText([
      piece(40, 700, 'Développeuse'),
      piece(105, 700, 'front-end'),
      piece(40, 686, 'Société Alpha'),
      piece(40, 640, 'FORMATION'),
    ])
    expect(text).toBe('Développeuse front-end\nSociété Alpha\n\nFORMATION')
  })

  it('reads a two-column CV one column after the other, the full-width title staying on top', () => {
    const left = ['COMPÉTENCES', 'Canva', 'Suite Adobe', 'Rédaction web', 'LANGUES', 'Anglais (B2)']
    const right = [
      'EXPÉRIENCES',
      'Chargé de communication — Mairie de Saint-Fictif',
      '2020 – 2024',
      'Animation des comptes Facebook et Instagram',
      'Assistant marketing — Librairie Delta',
      '2018 – 2020',
    ]
    const pieces = [
      piece(40, 760, 'Julien Morel — Chargé de communication digitale'),
      ...left.map((text, i) => piece(40, 700 - 14 * i, text)),
      ...right.map((text, i) => piece(200, 700 - 14 * i, text)),
    ]
    expect(pageText(pieces)).toBe(
      ['Julien Morel — Chargé de communication digitale', '', ...left, '', ...right].join('\n'),
    )
  })
})

describe('pageText with joined pieces', () => {
  // A table laid out row by row: the PDF joined the e-mail and the first experience into one piece (x = 40, the
  // experience starting at the gutter, x = 200).
  const sidebar = [
    'CONTACT',
    '',
    '06 00 00 00 01',
    'COMPÉTENCES',
    'Canva',
    'Suite Adobe',
    'Rédaction web',
    'LANGUES',
    'Anglais (B2)',
    'Espagnol (A2)',
    'QUALITÉS',
    'Créativité',
  ]
  const main = [
    'EXPÉRIENCES',
    '',
    '2020 – 2024',
    '• Animation des réseaux sociaux',
    '• Lettre mensuelle',
    'Assistant marketing — Librairie Delta',
    '2018 – 2020',
    '• Création des visuels',
    '• Suivi des statistiques',
    'FORMATION',
    'Licence Information-Communication',
    '2015 – 2018',
  ]
  const joined = `${'julien.morel@exemple.fr'.padEnd(31, '.')} Chargé de communication`

  it('cuts the joined piece at the gutter and reads each column on its own', () => {
    const pieces = [
      piece(40, 760, 'Julien Morel — Chargé de communication digitale'),
      ...sidebar.flatMap((t, i) => (t ? [piece(40, 700 - 14 * i, t)] : [])),
      ...main.flatMap((t, i) => (t ? [piece(200, 700 - 14 * i, t)] : [])),
      piece(40, 686, joined),
    ]
    expect(pageText(pieces)).toBe(
      [
        // Over the whole width, above the columns: not cut.
        'Julien Morel — Chargé de communication digitale',
        '',
        'CONTACT',
        'julien.morel@exemple.fr'.padEnd(31, '.'),
        '06 00 00 00 01',
        'COMPÉTENCES',
        'Canva',
        'Suite Adobe',
        'Rédaction web',
        'LANGUES',
        'Anglais (B2)',
        'Espagnol (A2)',
        'QUALITÉS',
        'Créativité',
        '',
        'EXPÉRIENCES',
        'Chargé de communication',
        '2020 – 2024',
        '• Animation des réseaux sociaux',
        '• Lettre mensuelle',
        'Assistant marketing — Librairie Delta',
        '2018 – 2020',
        '• Création des visuels',
        '• Suivi des statistiques',
        'FORMATION',
        'Licence Information-Communication',
        '2015 – 2018',
      ].join('\n'),
    )
  })
})

describe('findGutter', () => {
  it('finds no column in a single-column CV with right-aligned dates', () => {
    const pieces = [
      piece(40, 700, 'Développeuse front-end — Société Alpha'),
      piece(420, 700, '2021 – 2023'),
      piece(50, 686, '- Migration de l’application vers TypeScript et Vitest'),
      piece(50, 672, '- Encadrement de deux stagiaires sur le front-end'),
      piece(40, 650, 'Développeuse web junior — Agence Beta'),
      piece(420, 650, '2019 – 2021'),
      piece(50, 636, '- Création de dix sites WordPress sur mesure pour des clients'),
    ]
    expect(findGutter(pieces)).toBeNull()
  })

  it('finds the gutter between a sidebar and the main column', () => {
    const pieces = [
      ...['Canva', 'Suite Adobe', 'Google Analytics', 'Créativité'].map((t, i) => piece(40, 700 - 14 * i, t)),
      ...['Chargé de communication', 'Mairie de Saint-Fictif', 'Animation des réseaux', 'Lettre mensuelle'].map(
        (t, i) => piece(200, 700 - 14 * i, t),
      ),
    ]
    // Just before the left edge of the main column.
    expect(findGutter(pieces)).toBe(199.5)
  })

  it('keeps the gutter when a sidebar line touches the main column (long e-mail address)', () => {
    const pieces = [
      piece(40, 714, 'julien.morel@exemple.fr'.padEnd(32, '.')),
      ...['Canva', 'Suite Adobe', 'Google Analytics', 'Créativité'].map((t, i) => piece(40, 700 - 14 * i, t)),
      ...['Chargé de communication', 'Mairie de Saint-Fictif', 'Animation des réseaux', 'Lettre mensuelle'].map(
        (t, i) => piece(201, 714 - 14 * i, t),
      ),
    ]
    expect(findGutter(pieces)).toBe(200.5)
  })
})
