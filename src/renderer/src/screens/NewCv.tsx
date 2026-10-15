import type { ExportFormat } from '@core/api'
import { findTemplate, type TemplateId } from '@core/export/templates'
import type { Profile, TailoredCv } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'
import { describeError, type ErrorDescription } from '../errors'
import { texts } from '../i18n'
import { ActionBar, Button, Collapsible, ErrorAlert, Icon, TextField } from '../ui'
import { ExcludedItemsSection } from './new-cv/ExcludedItemsSection'
import { HighlightedSkillsSection } from './new-cv/HighlightedSkillsSection'
import { KeptExperiencesSection } from './new-cv/KeptExperiencesSection'
import { useTailoredCvDraft } from './new-cv/useTailoredCvDraft'
import { LargePreview, TemplateStrip } from './TemplateGallery'
import { usePreviews } from './template-gallery/usePreviews'
import { WhatChanged } from './WhatChanged'

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
  const draft = useTailoredCvDraft(profile, tailored)
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
      .then(({ hasApiKey: _key, ...p }) => window.api.saveSettings({ ...p, cvTemplate: id }))
      .catch(() => undefined)
  }

  const { previews } = usePreviews(draft.finalCv, cvTemplate)
  const template = findTemplate(cvTemplate)

  const exportAs = async (format: ExportFormat) => {
    lastFormat.current = format
    setError(null)
    setExporting(format)
    try {
      const path = await window.api.exportCv(draft.finalCv, format, cvTemplate)
      if (path) onExported(path)
    } catch (e) {
      setError(describeError('export', e))
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-8 px-6 sm:px-10 lg:px-16 py-8 sm:py-12 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <div className="space-y-4">
          <header className="space-y-2">
            <p className="flex items-center gap-2 font-bold text-marque">
              <Icon name="check-circle" />
              {texts.newCv.ready}
            </p>
            <h1 className="font-titre text-[1.75rem] leading-tight font-bold">{texts.newCv.title}</h1>
          </header>

          <Collapsible title={texts.newCv.headlineSection} open>
            <TextField label={texts.newCv.headlineLabel} value={draft.headline} onChange={draft.setHeadline} />
            <TextField
              label={texts.newCv.summaryLabel}
              multiline
              rows={5}
              value={draft.summary}
              onChange={draft.setSummary}
            />
          </Collapsible>

          <HighlightedSkillsSection
            present={draft.present}
            isPresentKept={draft.isPresentKept}
            onTogglePresent={draft.togglePresent}
            missing={tailored.requested.missing}
            isMissingAdded={(i) => draft.choices.addRequested[i] ?? false}
            onToggleMissing={draft.setRequestedAdded}
          />

          <KeptExperiencesSection
            experiences={tailored.experiences}
            kept={draft.choices.keepExperiences}
            onKept={(keepExperiences) => draft.setChoices((c) => ({ ...c, keepExperiences }))}
          />

          <ExcludedItemsSection
            excluded={tailored.excluded}
            reinstate={draft.choices.reinstate}
            onReinstate={draft.updateReinstate}
          />

          <Button variant="secondary" icon={comparing ? 'eye' : 'compare'} onClick={() => setComparing((c) => !c)}>
            {comparing ? texts.newCv.backToPreview : texts.newCv.showChanges}
          </Button>
        </div>

        <div className="min-w-0 space-y-5">
          {error && <ErrorAlert description={error} onAction={() => void exportAs(lastFormat.current)} />}
          {comparing ? (
            <WhatChanged
              profile={profile}
              tailored={tailored}
              finalCv={draft.finalCv}
              headline={draft.headline}
              onHeadline={draft.setHeadline}
              summary={draft.summary}
              onSummary={draft.setSummary}
              bullets={draft.bullets}
              onBullets={draft.setBullets}
              choices={draft.choices}
              onChoices={draft.setChoices}
            />
          ) : (
            <>
              <TemplateStrip previews={previews} value={cvTemplate} onChange={chooseTemplate} />
              <LargePreview
                html={previews[cvTemplate]?.html}
                error={previews[cvTemplate]?.error}
                templateName={texts.templates[template.id]}
                onPages={setPages}
              />
            </>
          )}
        </div>
      </div>

      <ActionBar maxWidth="max-w-7xl" left={texts.newCv.layout(texts.templates[template.id], pages)}>
        <Button
          variant="on-dark"
          onClick={() => void exportAs('docx')}
          busy={exporting === 'docx'}
          disabled={exporting !== null}
        >
          {texts.newCv.word}
        </Button>
        <Button
          variant="accent"
          size="large"
          icon="download"
          onClick={() => void exportAs('pdf')}
          busy={exporting === 'pdf'}
          disabled={exporting !== null}
        >
          {texts.newCv.pdf}
        </Button>
      </ActionBar>
    </>
  )
}
