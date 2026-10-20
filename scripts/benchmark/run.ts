// Profile extraction benchmark: runs `extractProfile` on the fictitious CVs of fixtures/benchmark and scores the
// result against the expected profile of each case (<case>.txt + <case>.expected.json).
//
//   npm run bench -- [--provider ollama|api|local] [--model name|path.gguf] [--runs 3] [--cases two-col] [--label before]
//                    [--timeout 10]  (minutes per case)
//   npm run bench -- --compare bench-results/a.json bench-results/b.json
//
// Provider configuration: see scripts/providers.ts. Results (scores, counts and timings only, never CV content) are
// written to bench-results/ (not committed), to compare a model or a change before and after.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import type { ExtractionCounts } from '../../src/core/diagnostics'
import { createProvider } from '../providers'
import { type CaseScore, type ExpectedProfile, type ListScore, scoreProfile } from './score'

const CASES_DIR = 'fixtures/benchmark'
const RESULTS_DIR = 'bench-results'

interface RunResult {
  case: string
  run: number
  seconds: number
  counts?: ExtractionCounts
  score?: CaseScore
  error?: string
}

interface BenchmarkReport {
  date: string
  label: string
  provider: string
  model: string
  results: RunResult[]
}

const pct = (value: number | null) => (value === null ? '  —' : `${Math.round(value * 100)}%`.padStart(4))
const list = (score: ListScore) =>
  `${score.found}/${score.expected}${score.extracted > score.found ? `+${score.extracted - score.found}` : ''}`
const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timeout after ${ms / 60_000} min`)
  }
}

async function loadCases(
  filter: string | undefined,
): Promise<{ name: string; text: string; expected: ExpectedProfile }[]> {
  const names = (await readdir(CASES_DIR))
    .filter((file) => file.endsWith('.txt'))
    .map((file) => basename(file, '.txt'))
    .filter((name) => !filter || name.includes(filter))
    .sort()
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: await readFile(join(CASES_DIR, `${name}.txt`), 'utf8'),
      expected: JSON.parse(await readFile(join(CASES_DIR, `${name}.expected.json`), 'utf8')) as ExpectedProfile,
    })),
  )
}

function printResults(results: RunResult[]): void {
  const columns = ['case', 'time', 'score', 'exp.', 'dates', 'bullets', 'edu.', 'skills', 'lang.', 'contact']
  const rows = results.map((r) =>
    r.score
      ? [
          `${r.case}${r.run > 1 ? ` #${r.run}` : ''}`,
          `${r.seconds.toFixed(1)} s`,
          pct(r.score.overall),
          list(r.score.experiences),
          pct(r.score.dates),
          pct(r.score.bullets),
          list(r.score.education),
          list(r.score.skills),
          list(r.score.languages),
          pct(r.score.contact),
        ]
      : [r.case, `${r.seconds.toFixed(1)} s`, 'ERROR', r.error ?? ''],
  )
  const widths = columns.map((c, i) => Math.max(c.length, ...rows.map((row) => (row[i] ?? '').length)))
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ')
  process.stdout.write(`\n${line(columns)}\n${rows.map(line).join('\n')}\n`)
  process.stdout.write('\nfound/expected(+extra). Score: mean F1 of the lists and contact share.\n')
  summarize(results)
}

function summarize(results: RunResult[]): void {
  const scored = results.filter((r) => r.score)
  const failures = results.length - scored.length
  process.stdout.write(
    `Mean score ${pct(mean(scored.map((r) => r.score?.overall ?? 0)))} | ` +
      `mean time ${mean(results.map((r) => r.seconds)).toFixed(1)} s | ` +
      `failures ${failures}/${results.length}\n`,
  )
}

async function compare(beforePath: string, afterPath: string): Promise<void> {
  const [before, after] = await Promise.all(
    [beforePath, afterPath].map(async (path) => JSON.parse(await readFile(path, 'utf8')) as BenchmarkReport),
  )
  if (!before || !after) return
  const byCase = (report: BenchmarkReport, name: string) => report.results.filter((r) => r.case === name)
  const score = (runs: RunResult[]) => mean(runs.map((r) => r.score?.overall ?? 0))
  const time = (runs: RunResult[]) => mean(runs.map((r) => r.seconds))
  const names = [...new Set([...before.results, ...after.results].map((r) => r.case))].sort()
  process.stdout.write(`\nbefore: ${before.label} (${before.model})\nafter:  ${after.label} (${after.model})\n\n`)
  for (const name of names) {
    const [b, a] = [byCase(before, name), byCase(after, name)]
    const delta = Math.round((score(a) - score(b)) * 100)
    process.stdout.write(
      `${name.padEnd(20)} score ${pct(score(b))} → ${pct(score(a))} (${delta >= 0 ? '+' : ''}${delta})   ` +
        `time ${time(b).toFixed(1)} s → ${time(a).toFixed(1)} s\n`,
    )
  }
  process.stdout.write('\nbefore: ')
  summarize(before.results)
  process.stdout.write('after:  ')
  summarize(after.results)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: 'string', default: 'ollama' },
      model: { type: 'string' },
      runs: { type: 'string', default: '1' },
      cases: { type: 'string' },
      label: { type: 'string' },
      timeout: { type: 'string', default: '10' },
      compare: { type: 'boolean', default: false },
    },
  })
  if (values.compare) {
    const [beforePath, afterPath] = positionals
    if (!beforePath || !afterPath) throw new Error('usage: npm run bench -- --compare before.json after.json')
    return compare(beforePath, afterPath)
  }

  const runs = Math.max(1, Number.parseInt(values.runs, 10) || 1)
  const cases = await loadCases(values.cases)
  if (cases.length === 0) throw new Error(`no case in ${CASES_DIR}`)
  // A model may generate until its context is full (tens of minutes on CPU): each case is bounded.
  const timeoutMs = Math.max(1, Number.parseFloat(values.timeout) || 10) * 60_000
  let provider = await createProvider(values.provider, values.model)
  const model = values.model ? basename(values.model) : (process.env.RECV_GGUF_MODEL ?? 'default')

  const results: RunResult[] = []
  try {
    for (const { name, text, expected } of cases) {
      for (let run = 1; run <= runs; run++) {
        process.stderr.write(`${name}${runs > 1 ? ` #${run}` : ''}… `)
        let counts: ExtractionCounts | undefined
        const start = performance.now()
        try {
          let timer: ReturnType<typeof setTimeout> | undefined
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs)
          })
          const extraction = provider.extractProfile(text, (c) => {
            counts = c
          })
          extraction.catch(() => undefined)
          const profile = await Promise.race([extraction, timeout]).finally(() => clearTimeout(timer))
          const seconds = (performance.now() - start) / 1000
          results.push({ case: name, run, seconds, counts, score: scoreProfile(profile, expected) })
        } catch (error) {
          const seconds = (performance.now() - start) / 1000
          results.push({ case: name, run, seconds, error: error instanceof Error ? error.message : String(error) })
          // The generation still runs: the model is released and loaded again for the next case.
          if (error instanceof TimeoutError) {
            await provider.release?.().catch(() => undefined)
            provider = await createProvider(values.provider, values.model)
          }
        }
        process.stderr.write(`${(results.at(-1)?.seconds ?? 0).toFixed(1)} s\n`)
      }
    }
  } finally {
    await provider.release?.()
  }

  printResults(results)
  const report: BenchmarkReport = {
    date: new Date().toISOString(),
    label: values.label ?? `${values.provider}-${model}`,
    provider: values.provider,
    model,
    results,
  }
  await mkdir(RESULTS_DIR, { recursive: true })
  const fileName = `${report.date.slice(0, 19).replace(/[:T]/g, '-')}-${report.label.replace(/[^\w.-]+/g, '_')}.json`
  await writeFile(join(RESULTS_DIR, fileName), `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`Results: ${join(RESULTS_DIR, fileName)}\n`)
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nError: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
  // A generation cut by the timeout may keep the native engine (and the process) alive.
  .finally(() => process.exit())
