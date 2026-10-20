// Shows what Re:CV reads in a real CV, to check the extraction on your own files (nothing is written, nothing leaves
// your computer, no model is loaded):
//   npm run read-cv -- cv.pdf [more.pdf more.docx …]
// For a PDF: the text as it was read before the reading order was rebuilt, the text now, and what is read in code
// (sections, skills, languages). The CV content is printed in this terminal only: never paste it into the repository.
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { extractText, getDocumentProxy } from 'unpdf'
import { extractDocxText, extractPdfText } from '../src/core/parsing'
import { readLanguages, readSkills } from '../src/core/parsing/cvReading'
import { detectCvSections } from '../src/core/parsing/cvSections'

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()
const title = (text: string) => process.stdout.write(`\n=== ${text} ===\n`)

async function oldPdfText(buffer: Buffer): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: true })
  return text.trim()
}

async function show(path: string): Promise<void> {
  const extension = extname(path).toLowerCase()
  const buffer = await readFile(path)
  process.stdout.write(`\n##### ${basename(path)}\n`)
  let text: string
  if (extension === '.pdf') {
    const [before, after] = await Promise.all([oldPdfText(buffer), extractPdfText(buffer)])
    text = after
    // Same words in the same order: the rebuilt reading order changed nothing (usual for a single column).
    const unchanged = squash(before) === squash(after)
    title(unchanged ? 'Reading order: unchanged (single column)' : 'Reading order: CHANGED')
    if (!unchanged) {
      title('Text before (order of the file)')
      process.stdout.write(`${before}\n`)
    }
  } else if (extension === '.docx') {
    text = await extractDocxText(buffer)
  } else if (extension === '.txt') {
    text = buffer.toString('utf8')
  } else {
    throw new Error('expected a .pdf, .docx or .txt file')
  }
  title('Text read')
  process.stdout.write(`${text}\n`)

  title('Read in code')
  const sections = detectCvSections(text)
  const found = Object.entries(sections).map(([name, present]) => `${present ? '✓' : '✗'} ${name}`)
  process.stdout.write(`Sections: ${found.join('  ')}\n`)
  process.stdout.write(`Skills (${readSkills(text).length}): ${readSkills(text).join(' | ')}\n`)
  const languages = readLanguages(text).map((l) => (l.level ? `${l.name} (${l.level})` : l.name))
  process.stdout.write(`Languages (${languages.length}): ${languages.join(' | ')}\n`)
}

async function main(): Promise<void> {
  const files = process.argv.slice(2)
  if (files.length === 0) throw new Error('usage: npm run read-cv -- cv.pdf [more.pdf more.docx …]')
  for (const file of files) {
    try {
      await show(file)
    } catch (error) {
      process.stdout.write(
        `\n##### ${basename(file)}\nError: ${error instanceof Error ? error.message : String(error)}\n`,
      )
      process.exitCode = 1
    }
  }
}

void main()
