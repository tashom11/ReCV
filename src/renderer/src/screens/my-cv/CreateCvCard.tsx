import { texts } from '../../i18n'
import { Button, Icon } from '../../ui'

/** Next to the drop zone, for people with no CV to import: the form opens on empty sections. */
export function CreateCvCard({ onCreate }: { onCreate: () => void }) {
  const words = texts.myCv.import.create
  return (
    <section className="flex flex-col items-center justify-center gap-4 rounded-panneau border-2 border-trait bg-surface px-6 py-11 text-center">
      <span
        className="flex size-[88px] items-center justify-center rounded-full border border-trait bg-papier text-encre"
        aria-hidden="true"
      >
        <Icon name="pencil" size={36} strokeWidth={2.2} />
      </span>
      <h2 className="pt-2 font-titre text-[1.75rem] leading-tight font-bold text-encre">{words.title}</h2>
      <p className="max-w-xs text-corps text-encre-douce">{words.text}</p>
      <Button size="large" variant="secondary" icon="plus" onClick={onCreate}>
        {words.button}
      </Button>
    </section>
  )
}
