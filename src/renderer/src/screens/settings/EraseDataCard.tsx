import { useState } from 'react'
import { describeError, type ErrorDescription, errorMessage } from '../../errors'
import { texts } from '../../i18n'
import { Button, Card, ConfirmDialog } from '../../ui'

/** « Mes données »: erases the profile, job postings, created CVs (and the API key), after an explicit confirmation. */
export function EraseDataCard({
  hasApiKey,
  onErased,
  onError,
}: {
  /** The API key is erased too: the confirmation says so. */
  hasApiKey: boolean
  onErased: () => void
  onError: (error: ErrorDescription) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [erasing, setErasing] = useState(false)

  const eraseAll = async () => {
    setErasing(true)
    try {
      await window.api.eraseData()
      onErased()
    } catch (e) {
      setConfirming(false)
      onError({
        ...describeError('settings', e),
        title: texts.settings.data.failed,
        text: errorMessage(e),
      })
    } finally {
      setErasing(false)
    }
  }

  return (
    <Card title={texts.settings.data.title} subtitle={texts.settings.data.subtitle}>
      <Button variant="danger" onClick={() => setConfirming(true)}>
        {texts.settings.data.erase}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={texts.settings.data.confirmTitle}
        confirmLabel={texts.settings.data.confirm}
        cancelLabel={texts.settings.data.cancel}
        onConfirm={() => void eraseAll()}
        onCancel={() => setConfirming(false)}
        busy={erasing}
      >
        <p>
          {texts.settings.data.confirmText}
          {hasApiKey ? texts.settings.data.confirmKey : ''}
          {texts.settings.data.end}
        </p>
      </ConfirmDialog>
    </Card>
  )
}
