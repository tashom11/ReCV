import { describe, expect, it } from 'vitest'
import { extraireTexteDocx } from './docx'
import { extraireTextePdf } from './pdf'

describe('extraireTextePdf', () => {
  it('rejette proprement un buffer qui n’est pas un PDF valide', async () => {
    const buffer = Buffer.from('ceci n’est pas un PDF')
    await expect(extraireTextePdf(buffer)).rejects.toThrow()
  })
})

describe('extraireTexteDocx', () => {
  it('rejette proprement un buffer qui n’est pas un DOCX valide', async () => {
    const buffer = Buffer.from('ceci n’est pas un DOCX')
    await expect(extraireTexteDocx(buffer)).rejects.toThrow()
  })
})
