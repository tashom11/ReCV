import type { Profile } from '@core/schemas'
import { useRef, useState } from 'react'
import { describeError, type ErrorAction, type ErrorDescription, errorMessage } from '../errors'
import { texts } from '../i18n'
import { useTaskProgress } from '../progress'
import { ActionBar, Button, Collapsible, ErrorAlert, Loading, TextField } from '../ui'
import { ContactSection } from './my-cv/ContactSection'
import { CvImportStep } from './my-cv/CvImportStep'
import { EducationList } from './my-cv/EducationList'
import { ExperienceList } from './my-cv/ExperienceList'
import { LanguageList } from './my-cv/LanguageList'
import { PhotoSection } from './my-cv/PhotoSection'
import { ProfileSummaryCard } from './my-cv/ProfileSummaryCard'
import { cleanProfile, emptyProfile, hasContent, skillCount, skillsSummary, toLines } from './my-cv/profileDraft'
import { useProfileDraft } from './my-cv/useProfileDraft'

/** Step ①: CV drop, then a check of what was understood, in collapsible sections. */
export function MyCvScreen({
  profile,
  fileName,
  online,
  onProfile,
  onNext,
  onSetup,
  onSettings,
}: {
  profile: Profile | null
  /** Name of the imported file, if known. */
  fileName: string | null
  /** An online service is chosen in the settings: do not promise that nothing is sent. */
  online: boolean
  onProfile: (profile: Profile, fileName?: string) => void
  onNext: () => void
  /** Opens the setup screen (engine not ready yet). */
  onSetup: () => void
  onSettings: () => void
}) {
  const { draft, update, saveStatus, beforeExplicitSave, afterExplicitSave } = useProfileDraft(profile, onProfile)
  const [busyWith, setBusyWith] = useState<'import' | 'saving' | 'summary' | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [summaryFeedback, setSummaryFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const lastImport = useRef<(() => void) | null>(null)
  // The CV was started from scratch in this session (otherwise it was read from a file, or saved earlier).
  const [created, setCreated] = useState(false)
  const importProgress = useTaskProgress('import', busyWith === 'import')
  const summaryProgress = useTaskProgress('summary', busyWith === 'summary')

  const importCv = async (file?: File) => {
    lastImport.current = () => void importCv(file)
    setBusyWith('import')
    setError(null)
    try {
      const result = file ? await window.api.importDroppedCv(file) : await window.api.importCv()
      if (result) {
        setCreated(false)
        onProfile(result.profile, result.fileName)
      }
    } catch (e) {
      setError(describeError('cv', e))
    } finally {
      setBusyWith(null)
    }
  }

  const createCv = () => {
    setError(null)
    setCreated(true)
    onProfile(emptyProfile())
  }

  const onErrorAction = (action: ErrorAction) => {
    setError(null)
    if (action === 'finish-setup') onSetup()
    else if (action === 'open-settings') onSettings()
    else if (action === 'retry') lastImport.current?.()
    else void importCv()
  }

  const proceed = async () => {
    if (!draft) return
    setBusyWith('saving')
    setError(null)
    beforeExplicitSave()
    try {
      const { profile: saved } = await window.api.saveProfile(cleanProfile(draft))
      afterExplicitSave()
      onProfile(saved)
      onNext()
    } catch (e) {
      setError({
        type: 'error',
        icon: 'restart',
        ...texts.myCv.saveFailed,
        actions: [],
        details: errorMessage(e),
      })
      setBusyWith(null)
    }
  }

  // Generic sentence, based on qualities: valid whatever the targeted job posting.
  const suggestSentence = async () => {
    if (!draft) return
    setBusyWith('summary')
    setSummaryFeedback(null)
    try {
      const summary = await window.api.generateSummary(cleanProfile(draft))
      update({ summary })
      setSummaryFeedback({ type: 'success', text: texts.myCv.contact.suggested })
    } catch (e) {
      const description = describeError('generating', e)
      setSummaryFeedback({
        type: 'error',
        text:
          description.code === 'engine-missing'
            ? description.title
            : description.code === 'no-quality'
              ? description.details
              : texts.myCv.contact.suggestFailed,
      })
    } finally {
      setBusyWith(null)
    }
  }

  if (!draft) {
    return (
      <CvImportStep
        error={error}
        onErrorAction={onErrorAction}
        importing={busyWith === 'import'}
        showProgressStep={importProgress !== null}
        offload={
          importProgress?.gpuLayers !== undefined && importProgress.totalLayers !== undefined
            ? { layers: importProgress.gpuLayers, total: importProgress.totalLayers }
            : undefined
        }
        online={online}
        onFile={(file) => void importCv(file)}
        onChoose={() => void importCv()}
        onCreate={createCv}
      />
    )
  }

  return (
    <>
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 sm:px-10 lg:px-16 py-10 sm:py-14">
        <ProfileSummaryCard
          draft={draft}
          fileName={fileName}
          importing={busyWith === 'import'}
          created={created}
          onImport={() => void importCv()}
        />

        {busyWith === 'import' && (
          <Loading
            title={texts.myCv.import.readingNew}
            step={importProgress ? texts.myCv.import.readingStep : undefined}
            note={texts.myCv.import.readingNewNote}
          />
        )}
        {error && <ErrorAlert description={error} onAction={onErrorAction} />}

        <header className="space-y-1 pt-2">
          <h2 className="font-titre text-titre-section font-bold">
            {created ? texts.myCv.check.createTitle : texts.myCv.check.title}
          </h2>
          <p className="text-corps text-encre-douce">{created ? texts.myCv.check.createText : texts.myCv.check.text}</p>
        </header>

        <div className="space-y-3">
          <ContactSection
            draft={draft}
            update={update}
            onSuggest={() => void suggestSentence()}
            suggesting={busyWith === 'summary'}
            suggestDisabled={busyWith !== null}
            showSuggestStep={summaryProgress !== null}
            feedback={summaryFeedback}
          />
          <ExperienceList experiences={draft.experiences} onChange={(experiences) => update({ experiences })} />
          <Collapsible
            title={texts.myCv.skills.title}
            count={skillCount(draft.skills)}
            summaryLine={skillsSummary(draft.skills)}
          >
            <TextField
              label={texts.myCv.skills.label}
              multiline
              rows={8}
              value={draft.skills.join('\n')}
              onChange={(v) => update({ skills: toLines(v) })}
              hint={texts.myCv.skills.hint}
            />
          </Collapsible>
          <EducationList education={draft.education} onChange={(education) => update({ education })} />
          <LanguageList languages={draft.languages} onChange={(languages) => update({ languages })} />
          <PhotoSection photo={draft.photo} onChange={(photo) => update({ photo })} />
        </div>
      </div>

      <ActionBar
        tone="light"
        maxWidth="max-w-3xl"
        left={
          saveStatus === 'error' ? (
            <span role="alert" className="font-bold text-erreur">
              {texts.myCv.autosaveFailed}
            </span>
          ) : hasContent(draft) ? (
            texts.myCv.autosaved
          ) : (
            texts.myCv.needContent
          )
        }
      >
        <Button
          size="large"
          endIcon="arrow-right"
          onClick={() => void proceed()}
          busy={busyWith === 'saving'}
          disabled={busyWith !== null || !hasContent(draft)}
        >
          {texts.myCv.next}
        </Button>
      </ActionBar>
    </>
  )
}
