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
import type { Block, CvDocument } from './cvDocument'
import { findTemplate, type TemplateId } from './templates'

// Tailles en demi-points (docx).
const BODY_SIZE = 21
const TITLE_SIZE = 40

interface Style {
  font: string
  accent: string
  text: string
  center: boolean
  banner?: string
  coloredTitle: boolean
}

function text(style: Style, content: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: content,
    font: style.font,
    size: options.size ?? BODY_SIZE,
    bold: options.bold,
    color: options.color ?? style.text,
  })
}

function blockParagraphs(style: Style, block: Block): Paragraph[] {
  switch (block.type) {
    case 'paragraphe':
      return [new Paragraph({ children: [text(style, block.text)] })]
    case 'liste':
      return block.elements.map((e) => new Paragraph({ children: [text(style, e)], bullet: { level: 0 } }))
    case 'entree': {
      const meta = [block.subtitle, block.dateRange].filter(Boolean).join(' | ')
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160 },
          children: [text(style, block.heading, { bold: true })],
        }),
        ...(meta ? [new Paragraph({ children: [text(style, meta, { color: '666666' })] })] : []),
        ...block.bullets.map((p) => new Paragraph({ children: [text(style, p)], bullet: { level: 0 } })),
      ]
    }
  }
}

/** Décode une image « data:image/…;base64,… » ; `null` si le format n'est pas pris en charge. */
function decodePhoto(dataUrl: string): { data: Buffer; type: 'jpg' | 'png' } | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
  if (!match?.[2]) return null
  return {
    data: Buffer.from(match[2], 'base64'),
    type: match[1]?.toLowerCase() === 'png' ? 'png' : 'jpg',
  }
}

/**
 * DOCX lisible par un ATS : vrais styles de titres, listes natives, aucun tableau ni zone de texte.
 * La photo (facultative) est une image flottante en haut à droite, sans incidence sur le texte.
 */
export async function generateDocxCv(model: CvDocument, templateId?: TemplateId): Promise<Buffer> {
  const chosen = findTemplate(templateId)
  const style: Style = {
    font: chosen.docx.font,
    accent: chosen.docx.accent,
    text: chosen.docx.text,
    center: chosen.docx.header === 'centre',
    banner: chosen.docx.banner,
    coloredTitle: chosen.docx.coloredSectionTitles,
  }
  const alignment = style.center ? AlignmentType.CENTER : AlignmentType.LEFT
  const onBanner = style.banner !== undefined
  const nameColor = onBanner ? 'FFFFFF' : style.accent
  const shading = style.banner ? { type: ShadingType.CLEAR, fill: style.banner, color: 'auto' } : undefined

  const photo = model.photo ? decodePhoto(model.photo) : null
  const photoImage = photo
    ? [
        new ImageRun({
          type: photo.type,
          data: photo.data,
          transformation: { width: 90, height: 90 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: 5_000_000 },
            verticalPosition: { relative: VerticalPositionRelativeFrom.MARGIN, offset: 0 },
          },
        }),
      ]
    : []

  const header: Paragraph[] = [
    ...(model.name
      ? [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: alignment,
            shading: shading,
            children: [...photoImage, text(style, model.name, { bold: true, size: TITLE_SIZE, color: nameColor })],
          }),
        ]
      : []),
    ...(model.title
      ? [
          new Paragraph({
            alignment: alignment,
            shading: shading,
            children: [text(style, model.title, { size: 24, color: onBanner ? '38BDF8' : style.accent })],
          }),
        ]
      : []),
    ...(model.contact.length > 0
      ? [
          new Paragraph({
            alignment: alignment,
            shading: shading,
            children: [text(style, model.contact.join(' | '), { color: onBanner ? 'CBD5E1' : '555555' })],
          }),
        ]
      : []),
  ]

  const sections = model.sections.flatMap((section) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: style.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 280, after: 80 },
      border: style.coloredTitle
        ? { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: style.accent } }
        : undefined,
      children: [
        text(style, section.title.toUpperCase(), {
          bold: true,
          size: 23,
          color: style.coloredTitle ? style.accent : style.text,
        }),
      ],
    }),
    ...section.blocks.flatMap((block) => blockParagraphs(style, block)),
  ])

  const document = new Document({
    title: model.name ? `CV - ${model.name}` : 'CV',
    styles: {
      default: {
        document: { run: { font: style.font, size: BODY_SIZE }, paragraph: { alignment: AlignmentType.LEFT } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [...header, ...sections],
      },
    ],
  })
  return Packer.toBuffer(document)
}
