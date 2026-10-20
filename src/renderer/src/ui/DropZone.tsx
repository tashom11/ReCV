import { useState } from 'react'
import { texts } from '../i18n'
import { Button } from './Button'
import { Icon } from './icons'

/**
 * Large CV drop zone. Drag and drop is a shortcut: the button stays the keyboard path (it opens the system file
 * picker).
 */
export function DropZone({
  onFile,
  onChoose,
  busyWith = false,
}: {
  onFile: (file: File) => void
  onChoose: () => void
  busyWith?: boolean
}) {
  const [hovering, setHovering] = useState(false)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse drop doubles the button, the only keyboard path
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!busyWith) setHovering(true)
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault()
        setHovering(false)
        const file = e.dataTransfer.files[0]
        if (file && !busyWith) onFile(file)
      }}
      className={`flex flex-col items-center justify-center gap-4 rounded-panneau px-6 py-11 text-center transition duration-(--duree-rapide) ${
        hovering ? 'border-2 border-marque bg-marque-pale' : 'border-2 border-dashed border-trait-fort bg-surface'
      }`}
    >
      <span
        className="flex size-[88px] items-center justify-center rounded-full border border-accent bg-accent-pale text-encre"
        aria-hidden="true"
      >
        <Icon name="drop" size={36} strokeWidth={2.2} />
      </span>
      <p className="pt-2 font-titre text-[1.75rem] leading-tight font-bold text-encre">
        {hovering ? texts.dropZone.drop : texts.dropZone.drag}
      </p>
      <p className="text-corps text-encre-douce">{texts.dropZone.or}</p>
      <Button size="large" icon="folder" onClick={onChoose} busy={busyWith}>
        {texts.dropZone.choose}
      </Button>
      <p className="pt-1 text-corps text-encre-douce">{texts.dropZone.formats}</p>
    </div>
  )
}
