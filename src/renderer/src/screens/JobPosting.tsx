import type { JobPostingPreview } from '@core/api'
import type { JobPosting, Requirements } from '@core/schemas'
import { useState } from 'react'
import { describeError, type ErrorAction, type ErrorDescription } from '../errors'
import { announcedDuration } from '../estimate'
import { useTaskProgress } from '../progress'
import { Button, ErrorAlert, Icon, LinkButton, Loading, PageTitle, Pill, SegmentedTabs, TextField } from '../ui'
import { tabId } from '../ui/SegmentedTabs'

type Mode = 'link' | 'text'

export interface ReadJobPosting {
  jobPosting: JobPosting
  preview: JobPostingPreview
}

const PANEL_ID = 'saisie-annonce'

/** What the job posting wishes for and the CV does not show: said without discouraging. */
function goodToKnow(requirements: Requirements): string | null {
  const sentences: string[] = []
  if (requirements.experience?.status === 'not-found') {
    sentences.push(`l’annonce souhaite « ${requirements.experience.required} ». Cela n’apparaît pas dans votre CV`)
  }
  if (requirements.education?.status === 'insufficient') {
    const profile = requirements.education.profileValue
      ? ` (votre CV indique « ${requirements.education.profileValue} »)`
      : ''
    sentences.push(`l’annonce demande « ${requirements.education.required} »${profile}`)
  }
  if (sentences.length === 0) return null
  return `${sentences.join(' ; ')}, mais cela ne vous empêche pas de postuler.`
}

/** Step ②: link or text of the job posting, then a confirmation card of what was read. */
export function JobPostingScreen({
  posting,
  onJobPosting,
  estimateS,
  generationError,
  onCreate,
  onBackToCv,
  onSetup,
}: {
  posting: ReadJobPosting | null
  onJobPosting: (posting: ReadJobPosting | null) => void
  /** Estimated generation duration, in seconds. */
  estimateS: number
  /** Last generation interrupted by an error, to report above the card. */
  generationError: ErrorDescription | null
  onCreate: () => void
  onBackToCv: () => void
  onSetup: () => void
}) {
  const [mode, setMode] = useState<Mode>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busyWith, setBusyWith] = useState<'reading' | 'analysis' | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [correction, setCorrection] = useState<JobPosting | null>(null)
  const progress = useTaskProgress('job-posting', busyWith !== null)

  // Reads the job posting (link or text), then spots what the employer is looking for: the confirmation card depends on
  // it.
  const read = async (source: Mode | JobPosting) => {
    setError(null)
    setBusyWith('reading')
    try {
      const jobPosting =
        typeof source !== 'string'
          ? source
          : source === 'link'
            ? await window.api.fetchJobPosting(url.trim())
            : await window.api.parseJobPostingText(text)
      setBusyWith('analysis')
      onJobPosting({ jobPosting, preview: await window.api.previewJobPosting(jobPosting) })
      setCorrection(null)
    } catch (e) {
      setError(describeError('posting', e))
    } finally {
      setBusyWith(null)
    }
  }

  const onErrorAction = (action: ErrorAction) => {
    setError(null)
    if (action === 'paste-text') setMode('text')
    else if (action === 'finish-setup') onSetup()
    else void read(posting ? posting.jobPosting : mode)
  }

  const loading = busyWith && (
    <Loading
      title={
        busyWith === 'reading' && mode === 'link' ? 'Nous ouvrons la page de l’annonce…' : 'Nous lisons l’annonce…'
      }
      step={progress ? 'Nous repérons le poste et ce que l’employeur recherche' : undefined}
      note="Cela prend généralement moins d’une minute."
    />
  )

  if (posting) {
    const { jobPosting, preview } = posting
    const note = goodToKnow(preview.requirements)
    const details = [jobPosting.company, jobPosting.location, preview.contractType].filter((v) => v && v.trim() !== '')
    return (
      <div className="mx-auto w-full max-w-4xl space-y-7 px-6 py-12">
        <PageTitle kicker="Annonce lue">C’est bien cette annonce ?</PageTitle>
        {generationError && (
          <ErrorAlert
            description={generationError}
            onAction={(action) => (action === 'finish-setup' ? onSetup() : onCreate())}
          />
        )}
        {error && <ErrorAlert description={error} onAction={onErrorAction} />}

        <article className="rounded-panneau border border-trait bg-surface shadow-panneau">
          <div className="space-y-6 p-8">
            <header className="flex items-start gap-5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-carte bg-marque-pale text-marque">
                <Icon name="briefcase" size={28} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.75rem] leading-tight font-bold text-encre">{jobPosting.jobTitle}</h2>
                {details.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-5 text-intro text-encre-douce">
                    {details.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </p>
                )}
              </div>
            </header>

            {preview.soughtSkills.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-corps font-bold text-encre">Ce que l’employeur recherche</h3>
                <ul className="flex flex-wrap gap-2.5">
                  {preview.soughtSkills.map((term) => (
                    <li key={term}>
                      <Pill>{term}</Pill>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {note && (
              <p className="flex items-start gap-3 rounded-carte bg-info-fond px-5 py-4 text-info">
                <Icon name="info" className="mt-0.5" />
                <span>
                  <strong>Bon à savoir :</strong> {note}
                </span>
              </p>
            )}
          </div>

          <details className="group border-t border-trait">
            <summary className="flex min-h-16 items-center gap-3 rounded-b-panneau px-8 font-bold text-marque">
              <Icon name="eye" />
              <span className="flex-1">Voir le texte complet de l’annonce</span>
              <Icon name="chevron-down" className="transition-transform duration-(--duree) group-open:rotate-180" />
            </summary>
            <div className="space-y-4 px-8 pb-8">
              {correction ? (
                <>
                  <TextField
                    label="Intitulé du poste"
                    value={correction.jobTitle}
                    onChange={(v) => setCorrection({ ...correction, jobTitle: v })}
                  />
                  <TextField
                    label="Texte de l’annonce"
                    multiline
                    rows={12}
                    value={correction.rawText}
                    onChange={(v) => setCorrection({ ...correction, rawText: v })}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => void read(correction)}
                      busy={busyWith !== null}
                      disabled={!correction.jobTitle.trim() || !correction.rawText.trim()}
                    >
                      Relire l’annonce corrigée
                    </Button>
                    <Button variant="secondary" onClick={() => setCorrection(null)} disabled={busyWith !== null}>
                      Ne rien changer
                    </Button>
                  </div>
                  {loading}
                </>
              ) : (
                <>
                  <p className="max-h-80 overflow-y-auto rounded-champ bg-papier p-4 whitespace-pre-wrap text-encre">
                    {jobPosting.rawText}
                  </p>
                  <Button variant="secondary" icon="pencil" onClick={() => setCorrection(jobPosting)}>
                    Corriger le texte
                  </Button>
                </>
              )}
            </div>
          </details>
        </article>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <LinkButton icon="arrow-left" onClick={() => onJobPosting(null)}>
            Ce n’est pas la bonne annonce
          </LinkButton>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-corps text-encre-douce">{announcedDuration(estimateS)}</span>
            <Button size="large" endIcon="arrow-right" onClick={onCreate} disabled={busyWith !== null}>
              Créer mon CV adapté
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      <PageTitle subtitle="Donnez-nous l’adresse de l’annonce. Si le site ne se laisse pas lire, collez simplement son texte.">
        Quelle annonce vous intéresse ?
      </PageTitle>
      {error && <ErrorAlert description={error} onAction={onErrorAction} />}

      <section className="space-y-6 rounded-panneau border border-trait bg-surface p-8 shadow-carte">
        <SegmentedTabs
          label="Façon de donner l’annonce"
          panelId={PANEL_ID}
          value={mode}
          onChange={setMode}
          disabled={busyWith !== null}
          tabs={[
            { id: 'link', label: 'Coller un lien', icon: 'link' },
            { id: 'text', label: 'Coller le texte', icon: 'clipboard' },
          ]}
        />
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(PANEL_ID, mode)} className="space-y-5">
          {mode === 'link' ? (
            <TextField
              label="Adresse de l’annonce"
              type="url"
              large
              value={url}
              onChange={setUrl}
              placeholder="Collez ici l’adresse (elle commence par https://)"
              hint="Astuce : dans votre navigateur, cliquez sur la barre d’adresse puis faites Ctrl + C pour copier."
            />
          ) : (
            <TextField
              label="Texte de l’annonce"
              multiline
              rows={10}
              value={text}
              onChange={setText}
              placeholder="Collez ici tout le texte de l’annonce"
              hint="Astuce : sur la page de l’annonce, sélectionnez le texte avec la souris, faites Ctrl + C, puis Ctrl + V ici."
            />
          )}
          <Button
            size="large"
            onClick={() => void read(mode)}
            busy={busyWith !== null}
            disabled={mode === 'link' ? !url.trim() : !text.trim()}
          >
            Lire l’annonce
          </Button>
          {loading}
        </div>
      </section>

      <LinkButton icon="arrow-left" onClick={onBackToCv}>
        Revenir à mon CV
      </LinkButton>
    </div>
  )
}
