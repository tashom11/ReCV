import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import type { Bloc, CvModele } from './modele'

const POLICE = 'Calibri'
// Tailles en demi-points (docx).
const TAILLE_CORPS = 21
const TAILLE_TITRE = 40

function texte(contenu: string, options: { gras?: boolean; taille?: number } = {}): TextRun {
  return new TextRun({ text: contenu, font: POLICE, size: options.taille ?? TAILLE_CORPS, bold: options.gras })
}

function paragrapheBloc(bloc: Bloc): Paragraph[] {
  switch (bloc.type) {
    case 'paragraphe':
      return [new Paragraph({ children: [texte(bloc.texte)] })]
    case 'liste':
      return bloc.elements.map((e) => new Paragraph({ children: [texte(e)], bullet: { level: 0 } }))
    case 'entree': {
      const meta = [bloc.sousTitre, bloc.periode].filter(Boolean).join(' | ')
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160 },
          children: [texte(bloc.intitule, { gras: true })],
        }),
        ...(meta ? [new Paragraph({ children: [texte(meta)] })] : []),
        ...bloc.points.map((p) => new Paragraph({ children: [texte(p)], bullet: { level: 0 } })),
      ]
    }
  }
}

/**
 * DOCX lisible par un ATS : vrais styles de titres, listes natives,
 * aucun tableau, aucune zone de texte, aucune image.
 */
export async function genererDocxCv(modele: CvModele): Promise<Buffer> {
  const entete: Paragraph[] = [
    ...(modele.nom
      ? [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [texte(modele.nom, { gras: true, taille: TAILLE_TITRE })],
          }),
        ]
      : []),
    ...(modele.titre ? [new Paragraph({ children: [texte(modele.titre, { taille: 24 })] })] : []),
    ...(modele.contact.length > 0 ? [new Paragraph({ children: [texte(modele.contact.join(' | '))] })] : []),
  ]

  const sections = modele.sections.flatMap((section) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 80 },
      children: [texte(section.titre.toUpperCase(), { gras: true, taille: 23 })],
    }),
    ...section.blocs.flatMap(paragrapheBloc),
  ])

  const document = new Document({
    title: modele.nom ? `CV - ${modele.nom}` : 'CV',
    styles: {
      default: {
        document: { run: { font: POLICE, size: TAILLE_CORPS }, paragraph: { alignment: AlignmentType.LEFT } },
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
