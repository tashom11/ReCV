// Rebuilds the reading order of a PDF page from the positions of its text pieces.
// A two-column CV (sidebar with contact, skills, languages next to the experiences) is often written line by line
// across the whole width: read in that order, a sidebar skill ends up in the middle of an experience (« Suite Adobe
// Chargé de communication — Mairie… »), which makes a model repeat or mix up items. Here each column is read on its
// own, top to bottom.

/** A piece of text of a page, in PDF units: `y` is the baseline measured from the bottom of the page. */
export interface TextPiece {
  text: string
  x: number
  y: number
  width: number
  height: number
}

// A column holds at least this share of the characters: right-aligned dates (« Lyon | 2017 – 2019 ») are not one.
const MIN_COLUMN_SHARE = 0.15
const MIN_COLUMN_LINES = 3
// Pieces allowed across the gutter (name or title over the whole width), as a share of the pieces.
const MAX_CROSSING_SHARE = 0.1

const characters = (pieces: TextPiece[]) => pieces.reduce((total, piece) => total + piece.text.trim().length, 0)
const lineHeight = (piece: TextPiece) => (piece.height > 0 ? piece.height : 10)

// Groups the pieces into lines (close baselines), top to bottom, each line left to right.
function lines(pieces: TextPiece[]): TextPiece[][] {
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x)
  const result: TextPiece[][] = []
  for (const piece of sorted) {
    const line = result.at(-1)
    const first = line?.[0]
    if (line && first && Math.abs(first.y - piece.y) <= Math.max(2, 0.4 * lineHeight(first))) line.push(piece)
    else result.push([piece])
  }
  return result.map((line) => line.sort((a, b) => a.x - b.x))
}

function lineText(line: TextPiece[]): string {
  let text = ''
  let end: number | undefined
  for (const piece of line) {
    // A visible gap between two pieces is a space, unless one of them already has it.
    const gap = end === undefined ? 0 : piece.x - end
    if (end !== undefined && gap > 0.15 * lineHeight(piece) && !/\s$/.test(text) && !/^\s/.test(piece.text)) {
      text += ' '
    }
    text += piece.text
    end = piece.x + piece.width
  }
  return text.replace(/\s+/g, ' ').trim()
}

// Text of a block read in one column: a larger vertical gap than usual between two lines starts a new paragraph.
function blockText(pieces: TextPiece[]): string[] {
  const output: string[] = []
  let previous: TextPiece | undefined
  for (const line of lines(pieces)) {
    const first = line[0]
    if (!first) continue
    if (previous && previous.y - first.y > 1.8 * lineHeight(previous) && output.at(-1) !== '') output.push('')
    const text = lineText(line)
    if (text) output.push(text)
    previous = first
  }
  return output
}

// A piece that only touches the gutter (a long e-mail address ending against the next column) does not cross it.
const TOLERANCE = 2
const crosses = (piece: TextPiece, x: number) => piece.x < x - TOLERANCE && piece.x + piece.width > x + TOLERANCE
const isLeft = (piece: TextPiece, x: number) => piece.x < x && !crosses(piece, x)
const isRight = (piece: TextPiece, x: number) => piece.x >= x

/**
 * X where the right column starts, or `null` if the page is read in a single column. A column has a left edge: several
 * lines start at the same x. Among these edges, in the middle of the page, the one crossed by the fewest pieces.
 */
export function findGutter(pieces: TextPiece[]): number | null {
  if (pieces.length === 0) return null
  const left = Math.min(...pieces.map((p) => p.x))
  const right = Math.max(...pieces.map((p) => p.x + p.width))
  const span = right - left
  if (span <= 0) return null
  const starts = new Map<number, number>()
  for (const p of pieces) starts.set(Math.round(p.x), (starts.get(Math.round(p.x)) ?? 0) + 1)
  const candidates = [...starts]
    .filter(([x, count]) => count >= MIN_COLUMN_LINES && x >= left + 0.2 * span && x <= left + 0.8 * span)
    .map(([x, count]) => ({ x, count, crossing: pieces.filter((p) => crosses(p, x)).length }))
    .sort((a, b) => a.crossing - b.crossing || b.count - a.count)
  const best = candidates[0]
  if (!best || best.crossing > MAX_CROSSING_SHARE * pieces.length) return null
  // Just before the edge: a piece at 182.8 belongs to the column starting at (rounded) 183.
  const gutter = best.x - 0.5

  // Both sides must be real columns, side by side.
  const leftPieces = pieces.filter((p) => isLeft(p, gutter))
  const rightPieces = pieces.filter((p) => isRight(p, gutter))
  const total = characters(pieces)
  for (const side of [leftPieces, rightPieces]) {
    if (characters(side) < MIN_COLUMN_SHARE * total || lines(side).length < MIN_COLUMN_LINES) return null
  }
  const range = (side: TextPiece[]) => [Math.min(...side.map((p) => p.y)), Math.max(...side.map((p) => p.y))] as const
  const [leftBottom, leftTop] = range(leftPieces)
  const [rightBottom, rightTop] = range(rightPieces)
  const overlap = Math.min(leftTop, rightTop) - Math.max(leftBottom, rightBottom)
  const shorter = Math.min(leftTop - leftBottom, rightTop - rightBottom)
  return overlap >= 0.5 * shorter ? gutter : null
}

// The PDF may join the end of a sidebar line and the start of the main column into one piece (« julien.morel@exemple.fr
// Chargé de communication »). Within the band where both columns have text, such a piece is cut at the space closest
// to the gutter (positions estimated from the average character width). Outside it (name, title over the whole
// width), nothing is cut.
function splitAtGutter(pieces: TextPiece[], gutter: number): TextPiece[] {
  const leftYs = pieces.filter((p) => isLeft(p, gutter)).map((p) => p.y)
  const rightYs = pieces.filter((p) => isRight(p, gutter)).map((p) => p.y)
  const bandTop = Math.min(Math.max(...leftYs), Math.max(...rightYs))
  const bandBottom = Math.max(Math.min(...leftYs), Math.min(...rightYs))
  return pieces.flatMap((piece) => {
    if (!crosses(piece, gutter) || piece.y > bandTop || piece.y < bandBottom) return [piece]
    const charWidth = piece.width / piece.text.length
    let cut: number | undefined
    for (let i = 0; i < piece.text.length; i++) {
      if (piece.text[i] !== ' ') continue
      const distance = Math.abs(piece.x + (i + 1) * charWidth - gutter)
      if (
        distance <= 2 * charWidth &&
        (cut === undefined || distance < Math.abs(piece.x + (cut + 1) * charWidth - gutter))
      ) {
        cut = i
      }
    }
    if (cut === undefined) return [piece]
    const rightX = Math.max(gutter + 0.5, piece.x + (cut + 1) * charWidth)
    return [
      { ...piece, text: piece.text.slice(0, cut), width: Math.min(cut * charWidth, gutter - piece.x - 0.5) },
      { ...piece, text: piece.text.slice(cut + 1), x: rightX, width: piece.x + piece.width - rightX },
    ]
  })
}

/**
 * Text of a page in reading order. With two columns: the lines over the whole width (name, title) stay where they
 * are; between two of them, the left column is read, then the right one.
 */
export function pageText(pieces: TextPiece[]): string {
  const shown = pieces.filter((p) => p.text.trim().length > 0)
  const gutter = findGutter(shown)
  if (gutter === null) return blockText(shown).join('\n')
  const visible = splitAtGutter(shown, gutter)

  const fullLines = lines(visible.filter((p) => crosses(p, gutter)))
  const output: string[] = []
  const readColumns = (top: number, bottom: number) => {
    const inBand = (p: TextPiece) => p.y < top && p.y > bottom && !crosses(p, gutter)
    for (const column of [
      visible.filter((p) => inBand(p) && isLeft(p, gutter)),
      visible.filter((p) => inBand(p) && isRight(p, gutter)),
    ]) {
      const text = blockText(column)
      if (text.length === 0) continue
      if (output.length > 0 && output.at(-1) !== '') output.push('')
      output.push(...text)
    }
  }
  let top = Number.POSITIVE_INFINITY
  for (const line of fullLines) {
    const y = line[0]?.y ?? 0
    readColumns(top, y)
    output.push(lineText(line))
    top = y
  }
  readColumns(top, Number.NEGATIVE_INFINITY)
  return output.join('\n').replace(/\n{3,}/g, '\n\n')
}
