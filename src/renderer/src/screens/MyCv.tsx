import type { Education, Experience, Language, Profile } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'
import { type AutosaveStatus, createAutosave } from '../autosave'
import { describeError, type ErrorAction, type ErrorDescription, messageErreur } from '../errors'
import { countOf, initials } from '../flow'
import { shrinkPhoto } from '../photo'
import { useTaskProgress } from '../progress'
import {
  ActionBar,
  Alert,
  Button,
  Collapsible,
  DropZone,
  ErrorAlert,
  Icon,
  Loading,
  PageTitle,
  Pill,
  Select,
  TextField,
} from '../ui'

const toLines = (text: string) => text.split('\n')
const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean)

// Edited lists keep their empty lines while typing; they are removed when saving.
function cleanProfile(profile: Profile): Profile {
  return {
    ...profile,
    links: clean(profile.links),
    skills: clean(profile.skills),
    experiences: profile.experiences.map((e) => ({ ...e, achievements: clean(e.achievements) })),
  }
}

// CEFR levels. The saved value is the one shown on the CV (« Anglais (C1) »).
const CEFR_LEVELS = [
  { value: '', label: 'Niveau non précisé' },
  { value: 'Langue maternelle', label: 'Langue maternelle' },
  { value: 'C2', label: 'C2 — Maîtrise' },
  { value: 'C1', label: 'C1 — Autonome, courant' },
  { value: 'B2', label: 'B2 — Intermédiaire supérieur' },
  { value: 'B1', label: 'B1 — Intermédiaire' },
  { value: 'A2', label: 'A2 — Élémentaire' },
  { value: 'A1', label: 'A1 — Débutant' },
]

// Keeps a level already present (e.g. « Courant » extracted from a CV) even if it is not in the list.
function levelOptions(current: string) {
  return current && !CEFR_LEVELS.some((n) => n.value === current)
    ? [...CEFR_LEVELS, { value: current, label: current }]
    : CEFR_LEVELS
}

// Pause in typing after which the draft is saved.
const AUTOSAVE_DELAY_MS = 800

const emptyExperience = (): Experience => ({ position: '', company: '', achievements: [] })
const emptyEducation = (): Education => ({ degree: '', school: '' })
const emptyLanguage = (): Language => ({ name: '' })

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((element, i) => (i === index ? value : element))
}

const joinNonEmpty = (...parts: (string | undefined)[]) => parts.filter((p) => p && p.trim() !== '').join(', ')

function experiencesSummary(experiences: Experience[]): string {
  const first = experiences[0]
  if (!first) return 'Aucune expérience pour l’instant'
  const rest = experiences.length - 1
  const more = rest > 0 ? ` · et ${rest} autre${rest > 1 ? 's' : ''}` : ''
  return joinNonEmpty(first.position, first.company, first.dateRange) + more
}

function skillsSummary(skills: string[]): string {
  const cleanItems = clean(skills)
  if (cleanItems.length === 0) return 'Aucune compétence pour l’instant'
  return cleanItems.slice(0, 4).join(', ') + (cleanItems.length > 4 ? '…' : '')
}

/** Step ①: CV drop, then a check of what was understood, in collapsible sections. */
export function MyCvScreen({
  profile,
  fileName,
  online,
  onProfile,
  onNext,
  onSetup,
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
}) {
  const [draft, setDraft] = useState<Profile | null>(profile)
  const [busyWith, setBusyWith] = useState<'import' | 'saving' | 'summary' | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  // Feedback shown under the field: the top of the page is out of view in the middle of the form.
  const [summaryFeedback, setSummaryFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const lastImport = useRef<(() => void) | null>(null)
  const importProgress = useTaskProgress('import', busyWith === 'import')
  const summaryProgress = useTaskProgress('summary', busyWith === 'summary')
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus | null>(null)
  const [autosave] = useState(() =>
    createAutosave<Profile>({
      delayMs: AUTOSAVE_DELAY_MS,
      save: async (draft) => void (await window.api.saveProfile(cleanProfile(draft))),
      onStatus: setSaveStatus,
    }),
  )
  // The draft differs from the profile known to the app: it is saved after a pause, and handed to the app
  // when the screen is left by any route (stepper, settings), so that no correction is lost.
  const dirty = useRef(false)
  const latest = useRef({ draft, onProfile })
  latest.current = { draft, onProfile }

  useEffect(() => {
    dirty.current = false
    autosave.cancel()
    setDraft(profile)
  }, [profile, autosave])

  useEffect(() => {
    if (dirty.current && draft) autosave.schedule(draft)
  }, [draft, autosave])

  useEffect(
    () => () => {
      if (!dirty.current) return
      const { draft, onProfile: handOver } = latest.current
      void autosave.flush().then(() => {
        if (draft) handOver(cleanProfile(draft))
      })
    },
    [autosave],
  )

  const importCv = async (file?: File) => {
    lastImport.current = () => void importCv(file)
    setBusyWith('import')
    setError(null)
    try {
      const result = file ? await window.api.importDroppedCv(file) : await window.api.importCv()
      if (result) onProfile(result.profile, result.fileName)
    } catch (e) {
      setError(describeError('cv', e))
    } finally {
      setBusyWith(null)
    }
  }

  const onErrorAction = (action: ErrorAction) => {
    setError(null)
    if (action === 'finish-setup') onSetup()
    else if (action === 'retry') lastImport.current?.()
    else void importCv()
  }

  const proceed = async () => {
    if (!draft) return
    setBusyWith('saving')
    setError(null)
    autosave.cancel()
    try {
      const { profile: saved } = await window.api.saveProfile(cleanProfile(draft))
      dirty.current = false
      onProfile(saved)
      onNext()
    } catch (e) {
      setError({
        type: 'error',
        icon: 'restart',
        title: 'Vos corrections n’ont pas pu être enregistrées',
        text: 'Rien n’est perdu : elles sont toujours affichées. Réessayez dans un instant.',
        actions: [],
        details: messageErreur(e),
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
      update({ summary: summary })
      setSummaryFeedback({ type: 'success', text: 'Voici une proposition : relisez-la et ajustez-la si besoin.' })
    } catch (e) {
      const description = describeError('generating', e)
      setSummaryFeedback({
        type: 'error',
        text: description.code === 'engine-missing' ? description.title : 'La proposition n’a pas abouti. Réessayez.',
      })
    } finally {
      setBusyWith(null)
    }
  }

  function update(partial: Partial<Profile>) {
    dirty.current = true
    setDraft((p) => (p ? { ...p, ...partial } : p))
  }

  if (!draft) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
        <PageTitle subtitle="Nous allons le lire pour comprendre votre parcours. Vous pourrez tout vérifier juste après.">
          Commençons par votre CV
        </PageTitle>
        {error && <ErrorAlert description={error} onAction={onErrorAction} />}
        {busyWith === 'import' ? (
          <Loading
            title="Nous lisons votre CV…"
            step={importProgress ? 'Nous repérons vos expériences, vos compétences et vos formations' : undefined}
            note="Cela prend une à deux minutes. Vous pouvez réduire la fenêtre en attendant."
          />
        ) : (
          <DropZone onFile={(file) => void importCv(file)} onChoose={() => void importCv()} />
        )}
        <p className="flex items-center gap-3 text-intro text-encre">
          <Icon name="lock" className="text-marque" />
          {online
            ? 'Votre CV sera lu par le service en ligne choisi dans les Réglages : il quitte votre ordinateur.'
            : 'Votre CV reste sur cet ordinateur : il n’est envoyé nulle part.'}
        </p>
      </div>
    )
  }

  const name = (draft.fullName ?? '').trim()
  const subtitle = [draft.headline, draft.location].filter((v) => v && v.trim() !== '').join(' · ')
  const skillCount = clean(draft.skills).length
  const counts = [
    countOf(draft.experiences.length, 'expérience', 'expériences'),
    countOf(draft.education.length, 'formation', 'formations'),
    countOf(skillCount, 'compétence ou qualité', 'compétences et qualités'),
    countOf(draft.languages.length, 'langue', 'langues'),
  ]

  return (
    <>
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-10">
        <section className="sur-sombre space-y-5 rounded-panneau bg-encre p-7 text-white shadow-panneau">
          <p className="flex items-center gap-2 font-bold text-accent">
            <Icon name="check-circle" />
            Votre CV est lu
          </p>
          <div className="flex items-center gap-5">
            {draft.photo ? (
              <img src={draft.photo} alt="" className="size-[72px] rounded-full border-2 border-accent object-cover" />
            ) : (
              <span
                className="flex size-[72px] shrink-0 items-center justify-center rounded-full border-2 border-accent bg-white/10 font-titre text-2xl font-bold"
                aria-hidden="true"
              >
                {initials(name) || '?'}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate font-titre text-[1.75rem] leading-tight font-bold">{name || 'Votre CV'}</h1>
              {subtitle && <p className="truncate text-intro text-white/85">{subtitle}</p>}
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {counts.map((c) => (
              <li key={c.name}>
                <Pill variant="on-dark">
                  <strong>{c.count}</strong> {c.name}
                </Pill>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-5">
            <p className="flex min-w-0 items-center gap-2.5 text-white/90">
              <Icon name="file" size={18} />
              <span className="truncate">{fileName ?? 'Votre CV enregistré'}</span>
            </p>
            <Button variant="on-dark" onClick={() => void importCv()} busy={busyWith === 'import'}>
              Utiliser un autre CV
            </Button>
          </div>
        </section>

        {busyWith === 'import' && (
          <Loading
            title="Nous lisons votre nouveau CV…"
            step={importProgress ? 'Nous repérons vos expériences, vos compétences et vos formations' : undefined}
            note="Votre CV actuel reste affiché tant que la lecture n’est pas terminée."
          />
        )}
        {error && <ErrorAlert description={error} onAction={onErrorAction} />}

        <header className="space-y-1 pt-2">
          <h2 className="font-titre text-titre-section font-bold">Vérifiez ce que nous avons compris</h2>
          <p className="text-corps text-encre-douce">
            Ouvrez une partie pour la corriger. Si tout vous semble juste, vous pouvez continuer directement.
          </p>
        </header>

        <div className="space-y-3">
          <Collapsible title="Vos coordonnées" summaryLine="Nom, métier, e-mail, téléphone, ville" open>
            {name !== '' && !/\s/.test(name) && (
              <Alert type="warning">
                Un seul mot dans « Prénom et nom » : il manque peut-être votre prénom (il apparaît en tête du CV).
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Prénom et nom"
                autoComplete="name"
                value={draft.fullName ?? ''}
                onChange={(v) => update({ fullName: v })}
              />
              <TextField
                label="Votre métier actuel"
                autoComplete="organization-title"
                value={draft.headline ?? ''}
                onChange={(v) => update({ headline: v })}
              />
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                value={draft.email ?? ''}
                onChange={(v) => update({ email: v })}
              />
              <TextField
                label="Téléphone"
                type="tel"
                autoComplete="tel"
                value={draft.phone ?? ''}
                onChange={(v) => update({ phone: v })}
              />
              <TextField
                label="Ville ou département"
                autoComplete="address-level2"
                value={draft.location ?? ''}
                onChange={(v) => update({ location: v })}
              />
              <TextField
                label="Liens (facultatif)"
                value={draft.links.join(', ')}
                placeholder="Ex. : votre page LinkedIn"
                onChange={(v) => update({ links: v.split(/,\s*/) })}
              />
            </div>
            <TextField
              label="Votre phrase de présentation"
              multiline
              toLines={3}
              value={draft.summary ?? ''}
              onChange={(v) => update({ summary: v })}
              hint="Elle parle de vos qualités, pas d’un métier : elle reste valable pour toutes les annonces."
              action={
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => void suggestSentence()}
                  busy={busyWith === 'summary'}
                  disabled={busyWith !== null}
                >
                  Proposer une phrase
                </Button>
              }
            />
            {busyWith === 'summary' && (
              <Loading
                title="Nous cherchons une phrase qui vous ressemble…"
                step={summaryProgress ? 'À partir de vos qualités' : undefined}
              />
            )}
            {summaryFeedback && <Alert type={summaryFeedback.type}>{summaryFeedback.text}</Alert>}
          </Collapsible>

          <Collapsible
            title="Vos expériences"
            count={draft.experiences.length}
            summaryLine={experiencesSummary(draft.experiences)}
          >
            {draft.experiences.map((experience, i) => {
              const updateExperience = (partial: Partial<Experience>) =>
                update({ experiences: replaceAt(draft.experiences, i, { ...experience, ...partial }) })
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
                <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
                  <legend className="px-2 text-libelle font-bold text-encre-douce">
                    {experience.position.trim() || `Expérience ${i + 1}`}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Poste"
                      value={experience.position}
                      onChange={(v) => updateExperience({ position: v })}
                    />
                    <TextField
                      label="Entreprise"
                      value={experience.company}
                      onChange={(v) => updateExperience({ company: v })}
                    />
                    <TextField
                      label="Dates"
                      value={experience.dateRange ?? ''}
                      placeholder="Ex. : 2019 – 2024"
                      onChange={(v) => updateExperience({ dateRange: v })}
                    />
                    <TextField
                      label="Ville"
                      value={experience.location ?? ''}
                      onChange={(v) => updateExperience({ location: v })}
                    />
                  </div>
                  <TextField
                    label="En une phrase (facultatif)"
                    multiline
                    toLines={2}
                    value={experience.description ?? ''}
                    onChange={(v) => updateExperience({ description: v })}
                  />
                  <TextField
                    label="Ce que vous avez fait (une idée par ligne)"
                    multiline
                    toLines={4}
                    value={experience.achievements.join('\n')}
                    onChange={(v) => updateExperience({ achievements: toLines(v) })}
                  />
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => update({ experiences: draft.experiences.filter((_, j) => j !== i) })}
                  >
                    Retirer cette expérience
                  </Button>
                </fieldset>
              )
            })}
            <Button
              variant="secondary"
              icon="plus"
              onClick={() => update({ experiences: [...draft.experiences, emptyExperience()] })}
            >
              Ajouter une expérience
            </Button>
          </Collapsible>

          <Collapsible title="Compétences et qualités" count={skillCount} summaryLine={skillsSummary(draft.skills)}>
            <TextField
              label="Vos compétences et qualités (une par ligne)"
              multiline
              toLines={8}
              value={draft.skills.join('\n')}
              onChange={(v) => update({ skills: toLines(v) })}
              hint="Quelques mots suffisent : « Organisation », « Travail en équipe », « Gestion des stocks »."
            />
          </Collapsible>

          <Collapsible
            title="Formations"
            count={draft.education.length}
            summaryLine={
              draft.education[0]
                ? joinNonEmpty(draft.education[0].degree, draft.education[0].school, draft.education[0].dateRange)
                : 'Aucune formation pour l’instant'
            }
          >
            {draft.education.map((education, i) => {
              const updateEducation = (partial: Partial<Education>) =>
                update({ education: replaceAt(draft.education, i, { ...education, ...partial }) })
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
                <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
                  <legend className="px-2 text-libelle font-bold text-encre-douce">
                    {education.degree.trim() || `Formation ${i + 1}`}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextField
                      label="Diplôme"
                      value={education.degree}
                      onChange={(v) => updateEducation({ degree: v })}
                    />
                    <TextField
                      label="Établissement"
                      value={education.school}
                      onChange={(v) => updateEducation({ school: v })}
                    />
                    <TextField
                      label="Année"
                      value={education.dateRange ?? ''}
                      onChange={(v) => updateEducation({ dateRange: v })}
                    />
                  </div>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => update({ education: draft.education.filter((_, j) => j !== i) })}
                  >
                    Retirer cette formation
                  </Button>
                </fieldset>
              )
            })}
            <Button
              variant="secondary"
              icon="plus"
              onClick={() => update({ education: [...draft.education, emptyEducation()] })}
            >
              Ajouter une formation
            </Button>
          </Collapsible>

          <Collapsible
            title="Langues"
            count={draft.languages.length}
            summaryLine={
              draft.languages.length > 0
                ? draft.languages.map((l) => (l.level ? `${l.name} : ${l.level.toLowerCase()}` : l.name)).join(' · ')
                : 'Aucune langue pour l’instant'
            }
          >
            {draft.languages.map((language, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
              <div key={i} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <TextField
                  label="Langue"
                  value={language.name}
                  onChange={(v) => update({ languages: replaceAt(draft.languages, i, { ...language, name: v }) })}
                />
                <Select
                  label="Niveau"
                  value={language.level ?? ''}
                  options={levelOptions(language.level ?? '')}
                  onChange={(v) => update({ languages: replaceAt(draft.languages, i, { ...language, level: v }) })}
                />
                <Button
                  variant="danger"
                  onClick={() => update({ languages: draft.languages.filter((_, j) => j !== i) })}
                >
                  Retirer
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              icon="plus"
              onClick={() => update({ languages: [...draft.languages, emptyLanguage()] })}
            >
              Ajouter une langue
            </Button>
          </Collapsible>

          <Collapsible
            title="Photo"
            count="facultative"
            summaryLine={
              draft.photo
                ? 'Une photo est choisie · elle reste sur votre ordinateur'
                : 'Aucune photo · elle reste sur votre ordinateur'
            }
          >
            <div className="flex flex-wrap items-center gap-5">
              {draft.photo ? (
                <img
                  src={draft.photo}
                  alt="Votre portrait"
                  className="size-24 rounded-full border border-trait object-cover"
                />
              ) : (
                <div
                  className="flex size-24 items-center justify-center rounded-full border-2 border-dashed border-trait-fort text-petit text-aide"
                  aria-hidden="true"
                >
                  Aucune
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-3">
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try {
                      update({ photo: await shrinkPhoto(file) })
                      setPhotoError(null)
                    } catch (readError) {
                      setPhotoError(messageErreur(readError))
                    }
                  }}
                />
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => photoInput.current?.click()}>
                    {draft.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </Button>
                  {draft.photo && (
                    <Button variant="danger" onClick={() => update({ photo: undefined })}>
                      Retirer la photo
                    </Button>
                  )}
                </div>
                <p className="text-petit text-aide">
                  Elle apparaît seulement dans les mises en page qui en prévoient une. Elle est recadrée en carré et
                  reste sur votre ordinateur.
                </p>
                {photoError && <Alert type="error">{photoError}</Alert>}
              </div>
            </div>
          </Collapsible>
        </div>
      </div>

      <ActionBar
        tone="light"
        maxWidth="max-w-3xl"
        left={
          saveStatus === 'error' ? (
            <span role="alert" className="font-bold text-erreur">
              Vos dernières corrections ne sont pas encore enregistrées. Elles le seront quand vous continuerez.
            </span>
          ) : (
            'Vos corrections sont enregistrées automatiquement.'
          )
        }
      >
        <Button
          size="large"
          endIcon="arrow-right"
          onClick={() => void proceed()}
          busy={busyWith === 'saving'}
          disabled={busyWith !== null}
        >
          Ça me va, continuer
        </Button>
      </ActionBar>
    </>
  )
}
