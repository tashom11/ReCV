import { extractText, getDocumentProxy } from 'unpdf'

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(document, { mergePages: true })
  return text.trim()
}
