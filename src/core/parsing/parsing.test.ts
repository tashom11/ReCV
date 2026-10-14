import { describe, expect, it } from 'vitest'
import { extractDocxText } from './docx'
import { extractPdfText } from './pdf'

describe('extractPdfText', () => {
  it('cleanly rejects a buffer that is not a valid PDF', async () => {
    const buffer = Buffer.from('ceci n’est pas un PDF')
    await expect(extractPdfText(buffer)).rejects.toThrow()
  })
})

describe('extractDocxText', () => {
  it('cleanly rejects a buffer that is not a valid DOCX', async () => {
    const buffer = Buffer.from('ceci n’est pas un DOCX')
    await expect(extractDocxText(buffer)).rejects.toThrow()
  })
})
