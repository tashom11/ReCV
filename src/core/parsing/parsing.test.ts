import { describe, expect, it } from 'vitest'
import { extractDocxText } from './docx'
import { extractPdfText } from './pdf'

describe('extraireTextePdf', () => {
  it('rejette proprement un buffer qui n’est pas un PDF valide', async () => {
    const buffer = Buffer.from('ceci n’est pas un PDF')
    await expect(extractPdfText(buffer)).rejects.toThrow()
  })
})

describe('extraireTexteDocx', () => {
  it('rejette proprement un buffer qui n’est pas un DOCX valide', async () => {
    const buffer = Buffer.from('ceci n’est pas un DOCX')
    await expect(extractDocxText(buffer)).rejects.toThrow()
  })
})
