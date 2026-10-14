import { useRef, useState } from 'react'
import { errorMessage } from '../../errors'
import { texts } from '../../i18n'
import { shrinkPhoto } from '../../photo'
import { Alert, Button, Collapsible } from '../../ui'

/** Optional photo: chosen by the user (never extracted from the CV), shrunk to a small square JPEG. */
export function PhotoSection({
  photo,
  onChange,
}: {
  photo: string | undefined
  onChange: (photo: string | undefined) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <Collapsible
      title={texts.myCv.photo.title}
      count={texts.myCv.photo.optional}
      summaryLine={photo ? texts.myCv.photo.chosen : texts.myCv.photo.none}
    >
      <div className="flex flex-wrap items-center gap-5">
        {photo ? (
          <img
            src={photo}
            alt={texts.myCv.photo.alt}
            className="size-24 rounded-full border border-trait object-cover"
          />
        ) : (
          <div
            className="flex size-24 items-center justify-center rounded-full border-2 border-dashed border-trait-fort text-petit text-aide"
            aria-hidden="true"
          >
            {texts.myCv.photo.placeholder}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                onChange(await shrinkPhoto(file))
                setError(null)
              } catch (readError) {
                setError(errorMessage(readError))
              }
            }}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => input.current?.click()}>
              {photo ? texts.myCv.photo.change : texts.myCv.photo.add}
            </Button>
            {photo && (
              <Button variant="danger" onClick={() => onChange(undefined)}>
                {texts.myCv.photo.remove}
              </Button>
            )}
          </div>
          <p className="text-petit text-aide">{texts.myCv.photo.note}</p>
          {error && <Alert type="error">{error}</Alert>}
        </div>
      </div>
    </Collapsible>
  )
}
