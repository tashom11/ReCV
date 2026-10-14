import { useState } from 'react'
import { texts } from '../../i18n'
import { Alert, Button, Card, Confirmation } from '../../ui'

/** Bug reports: copies a diagnostic report (no CV data) and shows exactly what was copied. */
export function DiagnosticsCard() {
  const words = texts.settings.diagnostics
  const [report, setReport] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copying, setCopying] = useState(false)

  const copy = async () => {
    setCopying(true)
    setFailed(false)
    try {
      setReport(await window.api.copyDiagnosticReport())
    } catch {
      setReport(null)
      setFailed(true)
    } finally {
      setCopying(false)
    }
  }

  return (
    <Card title={words.title} subtitle={words.subtitle}>
      <Button variant="secondary" icon="clipboard" onClick={() => void copy()} busy={copying}>
        {words.copy}
      </Button>
      {failed && <Alert type="error">{words.failed}</Alert>}
      {report && (
        <>
          <Confirmation>{words.copied}</Confirmation>
          <details>
            <summary className="inline-flex min-h-11 items-center font-bold text-marque underline underline-offset-4">
              {words.show}
            </summary>
            <pre className="overflow-x-auto rounded-champ bg-papier p-3 font-mono text-petit whitespace-pre-wrap break-words text-encre-douce">
              {report}
            </pre>
          </details>
        </>
      )}
    </Card>
  )
}
