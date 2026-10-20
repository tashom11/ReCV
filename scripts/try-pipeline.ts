// Runs the whole pipeline outside Electron:
//   npm run try -- cv.txt job-posting.txt [--provider ollama|api|local] [--model name]
// Configuration through environment variables (never a key as an argument):
//   RECV_OLLAMA_URL  (default http://localhost:11434/v1)
//   RECV_API_URL, RECV_API_KEY  (« api » provider, OpenAI-compatible)
//   RECV_GGUF_MODEL  (« local » provider, path of the .gguf file, unless given by --model)
// The TailoredCv JSON is written to stdout, the progress to stderr.
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createProvider } from './providers'

async function timed<T>(label: string, task: () => Promise<T>): Promise<T> {
  process.stderr.write(`${label}… `)
  const start = performance.now()
  const result = await task()
  process.stderr.write(`${((performance.now() - start) / 1000).toFixed(1)} s\n`)
  return result
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: 'string', default: 'ollama' },
      model: { type: 'string' },
    },
  })
  const [cvPath, jobPostingPath] = positionals
  if (!cvPath || !jobPostingPath) {
    throw new Error('usage: npm run try -- cv.txt job-posting.txt [--provider ollama|api|local] [--model name]')
  }
  const [cvText, jobPostingText] = await Promise.all([readFile(cvPath, 'utf8'), readFile(jobPostingPath, 'utf8')])
  const provider = await createProvider(values.provider, values.model)

  const profile = await timed('Profile extraction', () => provider.extractProfile(cvText))
  const jobPosting = await timed('Job posting extraction', () => provider.extractJobPosting(jobPostingText))
  const cv = await timed('CV tailoring', () => provider.tailorCv(profile, jobPosting))
  process.stdout.write(`${JSON.stringify(cv, null, 2)}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`\nError: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
