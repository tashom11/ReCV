import { useState } from 'react'
import { describeError, type ErrorDescription, errorMessage } from '../../errors'
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
        title: 'Vos données n’ont pas pu être effacées',
        text: errorMessage(e),
      })
    } finally {
      setErasing(false)
    }
  }

  return (
    <Card
      title="Mes données"
      subtitle="Votre CV, vos annonces et les CV créés sont enregistrés uniquement sur cet ordinateur."
    >
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Tout effacer…
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Tout effacer définitivement ?"
        confirmLabel="Oui, tout effacer"
        cancelLabel="Non, garder mes données"
        onConfirm={() => void eraseAll()}
        onCancel={() => setConfirming(false)}
        busy={erasing}
      >
        <p>
          Votre CV importé, vos annonces et vos CV créés seront supprimés de Re:CV. Les fichiers déjà téléchargés sur
          votre ordinateur ne sont pas touchés. Les réglages sont gardés
          {hasApiKey ? ', sauf votre clé personnelle, effacée elle aussi' : ''}.
        </p>
      </ConfirmDialog>
    </Card>
  )
}
