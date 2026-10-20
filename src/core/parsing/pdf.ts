import { extractText, getDocumentProxy } from 'unpdf'
import { pageText, type TextPiece } from './layout'

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(buffer))
  // Reading order rebuilt from the positions (two-column CVs); the text order of the file as a fallback.
  const pages: string[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const content = await page.getTextContent()
    const pieces: TextPiece[] = content.items.flatMap((item) =>
      'str' in item
        ? [
            {
              text: item.str,
              x: item.transform[4] ?? 0,
              y: item.transform[5] ?? 0,
              width: item.width,
              height: item.height || Math.abs(item.transform[3] ?? 0),
            },
          ]
        : [],
    )
    pages.push(pageText(pieces))
  }
  const text = pages.join('\n\n').trim()
  if (text) return text
  const { text: merged } = await extractText(document, { mergePages: true })
  return merged.trim()
}
