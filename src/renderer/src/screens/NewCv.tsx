import type { ExportFormat } from '@core/api'
import { findTemplate, type TemplateId } from '@core/export/templates'
import type { Profile, TailoredCv } from '@core/schemas'
import { type CompositionChoices, composeCv, initialChoices } from '@core/tailoring/composition'
import { formatSkill } from '@core/tailoring/skills'
import { useEffect, useMemo, useRef, useState } from 'react'
import { describeError, type ErrorDescription } from '../errors'
import { ActionBar, Button, Checkbox, Collapsible, ErrorAlert, Icon, TextField } from '../ui'
import { LargePreview, TemplateStrip, usePreviews } from './TemplateGallery'
import { WhatChanged } from './WhatChanged'

const replaceAt = <T,>(list: T[], index: number, value: T) => list.map((x, i) => (i === index ? value : x))
const key = (term: string) => formatSkill(term).toLowerCase()

/**
 * Step ③: the tailored CV in large, simple adjustments beside it, and the download always visible.
 * Nothing absent from the original CV enters it without a box ticked by the user.
 */
export function NewCvScreen({
  profile,
  tailored,
  onExported,
}: {
  profile: Profile
  tailored: TailoredCv
  onExported: (path: string) => void
}) {
  const [title, setHeadline] = useState(tailored.headline)
  const [summary, setSummary] = useState(tailored.summary)
  const [choices, setChoices] = useState<CompositionChoices>(() => initialChoices(tailored))
  const [bullets, setBullets] = useState<string[][]>(tailored.experiences.map((e) => e.bullets))
  // Skills already in the CV that the user unticks: they are only removed from this CV.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [cvTemplate, setCvTemplate] = useState<TemplateId>('classic')
  const [comparing, setComparing] = useState(false)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const lastFormat = useRef<ExportFormat>('pdf')

  // Last chosen layout (remembered setting).
  useEffect(() => {
    window.api.getSettings().then(
      (p) => setCvTemplate(p.cvTemplate),
      () => undefined,
    )
  }, [])

  const chooseTemplate = (id: TemplateId) => {
    setCvTemplate(id)
    window.api
      .getSettings()
      .then(({ hasApiKey: _cle, ...p }) => window.api.saveSettings({ ...p, cvTemplate: id }))
      .catch(() => undefined)
  }

  // Skills requested by the job posting and really present in the tailored CV.
  const present = useMemo(() => {
    const inCv = new Set([...tailored.keySkills, ...tailored.skills].map(key))
    return tailored.requested.evidenced.filter((term) => inCv.has(key(term))).map(formatSkill)
  }, [tailored])

  const finalCv = useMemo(() => {
    const composed = composeCv(
      profile,
      { ...tailored, headline: title.trim(), summary: summary.trim() },
      choices,
      bullets,
    )
    const keep = (skill: string) => !removed.has(key(skill))
    return {
      ...composed,
      keySkills: composed.keySkills.filter(keep),
      skills: composed.skills.filter(keep),
    }
  }, [profile, tailored, title, summary, choices, bullets, removed])

  const { previews } = usePreviews(finalCv)
  const { excluded } = tailored
  const { missing } = tailored.requested
  const excludedCount = excluded.experiences.length + excluded.skills.length + excluded.education.length
  const model = findTemplate(cvTemplate)

  const exportAs = async (format: ExportFormat) => {
    lastFormat.current = format
    setError(null)
    setExporting(format)
    try {
      const path = await window.api.exportCv(finalCv, format, cvTemplate)
      if (path) onExported(path)
    } catch (e) {
      setError(describeError('export', e))
    } finally {
      setExporting(null)
    }
  }

  const updateReinstate = (partial: Partial<CompositionChoices['reinstate']>) =>
    setChoices((c) => ({ ...c, reinstate: { ...c.reinstate, ...partial } }))

  const togglePresent = (term: string, kept: boolean) =>
    setRemoved((currentSet) => {
      const nextSet = new Set(currentSet)
      if (kept) nextSet.delete(key(term))
      else nextSet.add(key(term))
      return nextSet
    })

  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-8 px-6 py-8 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <div className="space-y-4">
          <header className="space-y-2">
            <p className="flex items-center gap-2 font-bold text-marque">
              <Icon name="check-circle" />
              Votre CV est prêt
            </p>
            <h1 className="font-titre text-[1.75rem] leading-tight font-bold">
              Relisez, ajustez si besoin, puis téléchargez
            </h1>
          </header>

          <Collapsible title="Titre et présentation" open>
            <TextField label="Titre du CV" value={title} onChange={setHeadline} />
            <TextField label="Phrase de présentation" multiline toLines={5} value={summary} onChange={setSummary} />
          </Collapsible>

          {(present.length > 0 || missing.length > 0) && (
            <Collapsible title="Compétences mises en avant" open>
              {present.length > 0 && (
                <fieldset>
                  <legend className="text-libelle font-bold text-marque">
                    Déjà dans votre CV · placées en premier
                  </legend>
                  {present.map((term) => (
                    <Checkbox
                      key={term}
                      label={term}
                      check={!removed.has(key(term))}
                      onChange={(v) => togglePresent(term, v)}
                    />
                  ))}
                </fieldset>
              )}
              {missing.length > 0 && (
                <fieldset className="rounded-bouton bg-alerte-fond p-4">
                  <legend className="float-left w-full text-libelle font-bold text-alerte">
                    Demandées par l’annonce, absentes de votre CV
                  </legend>
                  <p className="clear-both pt-1.5 pb-1 text-petit text-alerte">
                    Cochez seulement ce que vous savez vraiment faire : on pourra vous interroger dessus en entretien.
                  </p>
                  {missing.map((term, i) => (
                    <Checkbox
                      key={term}
                      label={formatSkill(term)}
                      check={choices.addRequested[i] ?? false}
                      onChange={(v) => setChoices((c) => ({ ...c, addRequested: replaceAt(c.addRequested, i, v) }))}
                    />
                  ))}
                </fieldset>
              )}
            </Collapsible>
          )}

          {excludedCount > 0 && (
            <Collapsible
              title="Retiré de ce CV"
              count={excludedCount}
              summaryLine="Sans rapport avec l’annonce · vous pouvez le remettre"
            >
              <fieldset>
                <legend className="text-petit text-aide">
                  Cochez ce que vous voulez remettre. Une expérience revient avec ses phrases de départ.
                </legend>
                {excluded.experiences.map((e, i) => (
                  <Checkbox
                    key={`${e.sourceIndex ?? i}-${e.position}-${e.company}`}
                    label={`${e.position} — ${e.company}`}
                    hint={e.dateRange}
                    check={choices.reinstate.experiences[i] ?? false}
                    onChange={(v) => updateReinstate({ experiences: replaceAt(choices.reinstate.experiences, i, v) })}
                  />
                ))}
                {excluded.education.map((f, i) => (
                  <Checkbox
                    key={`${f.degree}-${f.school}`}
                    label={`${f.degree} — ${f.school}`}
                    check={choices.reinstate.education[i] ?? false}
                    onChange={(v) => updateReinstate({ education: replaceAt(choices.reinstate.education, i, v) })}
                  />
                ))}
                {excluded.skills.map((c, i) => (
                  <Checkbox
                    key={c}
                    label={c}
                    check={choices.reinstate.skills[i] ?? false}
                    onChange={(v) => updateReinstate({ skills: replaceAt(choices.reinstate.skills, i, v) })}
                  />
                ))}
              </fieldset>
            </Collapsible>
          )}

          <Button variant="secondary" icon={comparing ? 'eye' : 'compare'} onClick={() => setComparing((c) => !c)}>
            {comparing ? 'Revenir à l’aperçu' : 'Voir ce qui a changé'}
          </Button>
        </div>

        <div className="min-w-0 space-y-5">
          {error && <ErrorAlert description={error} onAction={() => void exportAs(lastFormat.current)} />}
          {comparing ? (
            <WhatChanged
              profile={profile}
              tailored={tailored}
              finalCv={finalCv}
              title={title}
              onHeadline={setHeadline}
              summary={summary}
              onSummary={setSummary}
              bullets={bullets}
              onBullets={setBullets}
              choices={choices}
              onChoices={setChoices}
            />
          ) : (
            <>
              <TemplateStrip previews={previews} value={cvTemplate} onChange={chooseTemplate} />
              <LargePreview
                html={previews[cvTemplate]?.html}
                error={previews[cvTemplate]?.error}
                templateName={model.name}
                onPages={setPages}
              />
            </>
          )}
        </div>
      </div>

      <ActionBar maxWidth="max-w-7xl" left={`Mise en page « ${model.name} » · ${pages} page${pages > 1 ? 's' : ''}`}>
        <Button
          variant="on-dark"
          onClick={() => void exportAs('docx')}
          busy={exporting === 'docx'}
          disabled={exporting !== null}
        >
          Version Word (.docx)
        </Button>
        <Button
          variant="accent"
          size="large"
          icon="download"
          onClick={() => void exportAs('pdf')}
          busy={exporting === 'pdf'}
          disabled={exporting !== null}
        >
          Télécharger en PDF
        </Button>
      </ActionBar>
    </>
  )
}
