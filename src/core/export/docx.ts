import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  VerticalPositionRelativeFrom,
} from 'docx'
import type { Bloc, CvModele } from './modele'
import { type IdModele, trouverModele } from './modeles'

// Tailles en demi-points (docx).
const TAILLE_CORPS = 21
const TAILLE_TITRE = 40

interface Style {
  police: string
  accent: string
  texte: string
  centre: boolean
  bandeau?: string
  titreCouleur: boolean
}

function texte(style: Style, contenu: string, options: { gras?: boolean; taille?: number; couleur?: string } = {}) {
  return new TextRun({
    text: contenu,
    font: style.police,
    size: options.taille ?? TAILLE_CORPS,
    bold: options.gras,
    color: options.couleur ?? style.texte,
  })
}

function paragrapheBloc(style: Style, bloc: Bloc): Paragraph[] {
  switch (bloc.type) {
    case 'paragraphe':
      return [new Paragraph({ children: [texte(style, bloc.texte)] })]
    case 'liste':
      return bloc.elements.map((e) => new Paragraph({ children: [texte(style, e)], bullet: { level: 0 } }))
    case 'entree': {
      const meta = [bloc.sousTitre, bloc.periode].filter(Boolean).join(' | ')
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160 },
          children: [texte(style, bloc.intitule, { gras: true })],
        }),
        ...(meta ? [new Paragraph({ children: [texte(style, meta, { couleur: '666666' })] })] : []),
        ...bloc.points.map((p) => new Paragraph({ children: [texte(style, p)], bullet: { level: 0 } })),
      ]
    }
  }
}

/** Décode une image « data:image/…;base64,… » ; `null` si le format n'est pas pris en charge. */
function decoderPhoto(dataUrl: string): { donnees: Buffer; type: 'jpg' | 'png' } | null {
  const correspondance = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
  if (!correspondance?.[2]) return null
  return {
    donnees: Buffer.from(correspondance[2], 'base64'),
    type: correspondance[1]?.toLowerCase() === 'png' ? 'png' : 'jpg',
  }
}

/**
 * DOCX lisible par un ATS : vrais styles de titres, listes natives, aucun tableau ni zone de texte.
 * La photo (facultative) est une image flottante en haut à droite, sans incidence sur le texte.
 */
export async function genererDocxCv(modele: CvModele, idModele?: IdModele): Promise<Buffer> {
  const choisi = trouverModele(idModele)
  const style: Style = {
    police: choisi.docx.police,
    accent: choisi.docx.accent,
    texte: choisi.docx.texte,
    centre: choisi.docx.entete === 'centre',
    bandeau: choisi.docx.bandeau,
    titreCouleur: choisi.docx.titreSectionCouleur,
  }
  const alignement = style.centre ? AlignmentType.CENTER : AlignmentType.LEFT
  const surBandeau = style.bandeau !== undefined
  const couleurNom = surBandeau ? 'FFFFFF' : style.accent
  const ombrage = style.bandeau ? { type: ShadingType.CLEAR, fill: style.bandeau, color: 'auto' } : undefined

  const photo = modele.photo ? decoderPhoto(modele.photo) : null
  const imagePhoto = photo
    ? [
        new ImageRun({
          type: photo.type,
          data: photo.donnees,
          transformation: { width: 90, height: 90 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: 5_000_000 },
            verticalPosition: { relative: VerticalPositionRelativeFrom.MARGIN, offset: 0 },
          },
        }),
      ]
    : []

  const entete: Paragraph[] = [
    ...(modele.nom
      ? [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: alignement,
            shading: ombrage,
            children: [
              ...imagePhoto,
              texte(style, modele.nom, { gras: true, taille: TAILLE_TITRE, couleur: couleurNom }),
            ],
          }),
        ]
      : []),
    ...(modele.titre
      ? [
          new Paragraph({
            alignment: alignement,
            shading: ombrage,
            children: [texte(style, modele.titre, { taille: 24, couleur: surBandeau ? '38BDF8' : style.accent })],
          }),
        ]
      : []),
    ...(modele.contact.length > 0
      ? [
          new Paragraph({
            alignment: alignement,
            shading: ombrage,
            children: [texte(style, modele.contact.join(' | '), { couleur: surBandeau ? 'CBD5E1' : '555555' })],
          }),
        ]
      : []),
  ]

  const sections = modele.sections.flatMap((section) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: style.centre ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 280, after: 80 },
      border: style.titreCouleur
        ? { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: style.accent } }
        : undefined,
      children: [
        texte(style, section.titre.toUpperCase(), {
          gras: true,
          taille: 23,
          couleur: style.titreCouleur ? style.accent : style.texte,
        }),
      ],
    }),
    ...section.blocs.flatMap((bloc) => paragrapheBloc(style, bloc)),
  ])

  const document = new Document({
    title: modele.nom ? `CV - ${modele.nom}` : 'CV',
    styles: {
      default: {
        document: { run: { font: style.police, size: TAILLE_CORPS }, paragraph: { alignment: AlignmentType.LEFT } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [...entete, ...sections],
      },
    ],
  })
  return Packer.toBuffer(document)
}
