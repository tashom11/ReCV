import type { LocalModelState, ModelDownloadProgress, ModelsState, Settings, SettingsState } from '@core/api'
import { isLocalService } from '@core/serviceUrl'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { downloadAnnouncement } from '../accessibility'
import { describeError, type ErrorDescription, messageErreur } from '../errors'
import { formatSize } from '../estimate'
import { hasUnsavedTextChanges } from '../settingsDraft'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Confirmation,
  ErrorAlert,
  Icon,
  PageTitle,
  Pill,
  Select,
  TextField,
} from '../ui'
import { UpdatesCard } from './Updates'

// The three local models, named by what they change for the user.
const LEVELS: Record<string, { name: string; detail: string }> = {
  'qwen3.5-2b': { name: 'Rapide', detail: 'Pour les ordinateurs modestes' },
  'qwen3.5-4b': { name: 'Équilibré', detail: 'Bon résultat sur la plupart des ordinateurs' },
  'qwen3.5-9b': { name: 'Soigné', detail: 'Meilleur résultat' },
}

const SERVICES = [
  { value: 'https://api.openai.com/v1', label: 'OpenAI' },
  { value: 'https://api.mistral.ai/v1', label: 'Mistral' },
  { value: 'https://openrouter.ai/api/v1', label: 'OpenRouter' },
]
const OTHER_SERVICE = 'autre'

/** Selectable card (radio button): the whole block is clickable, the choice is outlined and named. */
function EngineChoiceCard({
  chosen,
  onChoose,
  title,
  label,
  description,
  highlighted = false,
  children,
}: {
  chosen: boolean
  onChoose: () => void
  title: string
  label?: ReactNode
  description: string
  highlighted?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`rounded-carte ${
        chosen
          ? `border-2 border-marque ${highlighted ? 'bg-marque-pale' : 'bg-surface'}`
          : 'border border-trait bg-surface p-px'
      }`}
    >
      <label className="flex min-h-11 items-start gap-3.5 p-4">
        <input type="radio" name="moteur" className="mt-1 size-5 shrink-0" checked={chosen} onChange={onChoose} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2.5 text-intro font-bold text-encre">
            {title}
            {label}
          </span>
          <span className="block text-corps text-encre-douce">{description}</span>
        </span>
      </label>
      {children && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  )
}

/** Choice and installation of the model running on the computer: Rapide, Équilibré or Soigné. */
function ModelLevels({
  activePath,
  onActive,
  onState,
}: {
  activePath: string | undefined
  /** An installed model is chosen, or has just been installed. */
  onActive: (path: string | undefined) => void
  onState: (state: ModelsState) => void
}) {
  const [state, setState] = useState<ModelsState | null>(null)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [busyWith, setBusyWith] = useState<string | null>(null)

  const refresh = useCallback(
    () =>
      window.api.getModelsState().then(
        (e) => {
          setState(e)
          setProgress(e.download)
          onState(e)
          return e
        },
        () => null,
      ),
    [onState],
  )

  useEffect(() => {
    void refresh()
    return window.api.onModelProgress((p) => {
      setProgress(p)
      if (p.status === 'done') {
        // The main process has selected the installed model: this choice is taken over.
        void refresh().then((e) => onActive(e?.models.find((m) => m.id === p.id)?.path))
      }
      if (p.status === 'cancelled' || p.status === 'error') void refresh()
    })
  }, [refresh, onActive])

  const busy = progress?.status === 'downloading' || progress?.status === 'verifying'

  const install = async (id: string) => {
    setError(null)
    setBusyWith(id)
    try {
      await window.api.downloadModel(id)
    } catch (e) {
      setError(describeError('setup', e))
    } finally {
      setBusyWith(null)
    }
  }

  const remove = async (m: LocalModelState) => {
    setError(null)
    setBusyWith(m.id)
    try {
      await window.api.deleteModel(m.id)
      const after = await refresh()
      if (activePath === m.path) onActive(after?.models.find((x) => x.installed)?.path)
    } catch (e) {
      setError(describeError('settings', e))
    } finally {
      setBusyWith(null)
    }
  }

  if (!state) return null

  return (
    <fieldset className="space-y-2.5">
      <legend className="pb-2 text-corps font-bold text-encre">Rapidité ou soin du résultat</legend>
      {error && (
        <ErrorAlert
          description={error}
          onAction={() => setError(null)}
          labels={{ dismiss: 'Compris' }}
          headingLevel={3}
        />
      )}
      {state.models.map((m) => {
        const level = LEVELS[m.id] ?? { name: m.name, detail: m.description }
        const active = m.installed && activePath === m.path
        const download = progress?.id === m.id && busy ? progress : null
        const percent =
          download && download.totalBytes > 0 ? Math.round((download.receivedBytes / download.totalBytes) * 100) : 0
        const slowNote = m.compatible ? '' : ', mais lent sur votre ordinateur'
        return (
          <div
            key={m.id}
            className={`space-y-3 rounded-carte bg-surface p-4 ${active ? 'border-2 border-marque' : 'border border-trait p-[17px]'}`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex min-h-11 min-w-0 flex-1 items-start gap-3.5">
                <input
                  type="radio"
                  name="niveau-modele"
                  className="mt-1 size-5 shrink-0"
                  checked={active}
                  disabled={!m.installed}
                  onChange={() => onActive(m.path)}
                />
                <span className="min-w-0">
                  <span className="block text-corps text-encre">
                    <strong>{level.name}</strong>
                    {m.recommended && <span className="text-marque"> · conseillé pour votre ordinateur</span>}
                  </span>
                  <span className="block text-petit text-aide">
                    {m.installed
                      ? `Installé · ${formatSize(m.sizeBytes)}`
                      : `${level.detail}${slowNote} · ${formatSize(m.sizeBytes)} à télécharger`}
                  </span>
                </span>
              </label>
              {m.installed ? (
                <Button
                  variant="danger"
                  size="small"
                  disabled={busy || busyWith !== null}
                  busy={busyWith === m.id}
                  onClick={() => void remove(m)}
                >
                  Supprimer
                </Button>
              ) : download ? (
                <Button variant="secondary" size="small" onClick={() => void window.api.cancelDownload()}>
                  Mettre en pause
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="small"
                  disabled={busy || busyWith !== null}
                  busy={busyWith === m.id}
                  onClick={() => void install(m.id)}
                >
                  Installer
                </Button>
              )}
            </div>
            {download && (
              <div className="space-y-1.5">
                <div
                  role="progressbar"
                  aria-label={`Téléchargement du niveau ${level.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className="h-2.5 overflow-hidden rounded-full bg-creux"
                >
                  {download.status === 'verifying' ? (
                    <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
                  ) : (
                    <div className="h-full rounded-full bg-marque transition-all" style={{ width: `${percent}%` }} />
                  )}
                </div>
                <p className="text-petit text-aide">
                  {download.status === 'verifying'
                    ? 'Vérification du fichier… quelques secondes'
                    : `${formatSize(download.receivedBytes)} sur ${formatSize(download.totalBytes)} (${percent} %)`}
                </p>
                <p className="sr-only" role="status">
                  {downloadAnnouncement(percent, download.status === 'verifying')}
                </p>
              </div>
            )}
            {progress?.id === m.id && progress.status === 'cancelled' && (
              <p className="text-petit text-aide">En pause : le téléchargement reprendra là où il s’était arrêté.</p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}

/**
 * Settings, outside the flow: the recommended engine is already chosen, the rest is collapsed in the advanced options.
 */
export function SettingsScreen({
  onChange,
  onErased,
}: {
  /** The settings or the installed models have changed. */
  onChange: () => void
  /** All the data has been erased. */
  onErased: () => void
}) {
  const [state, setState] = useState<SettingsState | null>(null)
  // What is actually saved: immediate choices are applied on top of it, never on top of half-typed fields.
  const [saved, setSaved] = useState<SettingsState | null>(null)
  const [models, setModels] = useState<ModelsState | null>(null)
  const [key, setKey] = useState('')
  const [otherService, setOtherService] = useState(false)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [busyWith, setBusyWith] = useState<'save' | 'key' | 'erase' | null>(null)
  const [erasing, setErasing] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(
      (p) => {
        setState(p)
        setSaved(p)
        setOtherService(!SERVICES.some((s) => s.value === p.apiUrl))
      },
      (e) => setError(describeError('settings', e)),
    )
  }, [])

  // Short confirmation: it disappears on its own.
  useEffect(() => {
    if (!confirmation) return
    const timer = setTimeout(() => setConfirmation(null), 5000)
    return () => clearTimeout(timer)
  }, [confirmation])

  const onModelsState = useCallback(
    (e: ModelsState) => {
      setModels(e)
      onChange()
    },
    [onChange],
  )
  // A choice (engine, model level, rewriting) is saved at once: leaving the screen never loses it.
  const choose = async (partial: Partial<Settings>) => {
    setState((e) => (e ? { ...e, ...partial } : e))
    if (!saved) return
    setError(null)
    try {
      const { hasApiKey: _ignore, ...base } = saved
      setSaved(await window.api.saveSettings({ ...base, ...partial }))
      onChange()
    } catch (e) {
      setError(describeError('settings', e))
    }
  }
  const chooseRef = useRef(choose)
  chooseRef.current = choose
  const onActiveModel = useCallback((path: string | undefined) => {
    void chooseRef.current({ localModelPath: path })
  }, [])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        {error ? <ErrorAlert description={error} onAction={() => undefined} /> : <p role="status">Un instant…</p>}
      </div>
    )
  }

  const update = (partial: Partial<Settings>) => setState({ ...state, ...partial })
  const local = state.provider === 'local'
  const ready = local && (Boolean(state.localModelPath) || Boolean(models?.models.some((m) => m.installed)))

  const save = async () => {
    setError(null)
    setConfirmation(null)
    setBusyWith('save')
    try {
      const { hasApiKey: _ignore, ...settings } = state
      // Settings first: changing service deletes the old key, the new one is saved afterwards.
      let after = await window.api.saveSettings(settings)
      if (key.trim()) after = await window.api.setApiKey(key.trim())
      setKey('')
      setState(after)
      setSaved(after)
      setConfirmation(
        state.hasApiKey && !after.hasApiKey
          ? 'Réglages enregistrés. Le service a changé : saisissez à nouveau votre clé personnelle.'
          : 'Vos réglages sont enregistrés.',
      )
      onChange()
    } catch (e) {
      setError(describeError('settings', e))
    } finally {
      setBusyWith(null)
    }
  }

  const removeKey = async () => {
    setError(null)
    setBusyWith('key')
    try {
      setState({ ...state, hasApiKey: (await window.api.setApiKey('')).hasApiKey })
      setConfirmation('Votre clé personnelle est supprimée.')
    } catch (e) {
      setError(describeError('settings', e))
    } finally {
      setBusyWith(null)
    }
  }

  const toutEffacer = async () => {
    setError(null)
    setBusyWith('erase')
    try {
      await window.api.eraseData()
      onErased()
    } catch (e) {
      setError({
        ...describeError('settings', e),
        title: 'Vos données n’ont pas pu être effacées',
        text: messageErreur(e),
      })
      setBusyWith(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <PageTitle subtitle="La plupart des personnes n’ont rien à changer ici.">Réglages</PageTitle>
      {error && <ErrorAlert description={error} onAction={() => setError(null)} />}

      <Card title="Moteur d’intelligence artificielle" subtitle="C’est lui qui lit votre CV et l’annonce.">
        <EngineChoiceCard
          chosen={local}
          onChoose={() => void choose({ provider: 'local' })}
          title="Sur mon ordinateur"
          label={<Pill variant="recommended">Recommandé</Pill>}
          description="Gratuit et privé : rien ne quitte votre ordinateur. Fonctionne sans internet."
          highlighted
        >
          {local && (
            <p className={`flex items-center gap-2 pl-[34px] font-bold ${ready ? 'text-marque' : 'text-alerte'}`}>
              <Icon name={ready ? 'check-circle' : 'warning'} size={18} />
              {ready ? 'Prêt à l’emploi' : 'Il manque un téléchargement : installez un niveau ci-dessous'}
            </p>
          )}
        </EngineChoiceCard>

        <ModelLevels activePath={state.localModelPath} onActive={onActiveModel} onState={onModelsState} />

        <details open={!local} className="group rounded-carte border border-trait bg-papier">
          <summary className="flex min-h-16 items-center gap-4 rounded-carte px-5 py-3">
            <span className="flex-1">
              <span className="block font-titre text-intro font-bold">Options avancées</span>
              <span className="block text-petit text-aide">Pour les personnes à l’aise avec l’informatique</span>
            </span>
            <Icon name="chevron-down" className="transition-transform duration-(--duree) group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-5 pb-5">
            <EngineChoiceCard
              chosen={state.provider === 'ollama'}
              onChoose={() => void choose({ provider: 'ollama' })}
              title="Ollama (installé séparément)"
              description="Utilise un modèle servi par Ollama sur cet ordinateur. Les données restent chez vous."
            >
              {state.provider === 'ollama' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Adresse d’Ollama"
                      value={state.ollamaUrl}
                      onChange={(v) => update({ ollamaUrl: v })}
                    />
                    <TextField label="Modèle" value={state.ollamaModel} onChange={(v) => update({ ollamaModel: v })} />
                  </div>
                  {!isLocalService(state.ollamaUrl) && (
                    <Alert type="warning">
                      <strong>Cette adresse n’est pas celle de votre ordinateur.</strong> Votre CV et l’annonce seront
                      envoyés à cet appareil
                      {state.ollamaUrl.startsWith('http:') ? ', sans chiffrement sur le réseau' : ''}.
                    </Alert>
                  )}
                </>
              )}
            </EngineChoiceCard>

            <EngineChoiceCard
              chosen={state.provider === 'api'}
              onChoose={() => void choose({ provider: 'api' })}
              title="Service en ligne avec ma clé personnelle"
              description="OpenAI, Mistral, OpenRouter… Rapide, mais payant selon le service."
            >
              {state.provider === 'api' && (
                <>
                  <Alert type="warning">
                    <strong>Votre CV et l’annonce seront envoyés à ce service.</strong> Ils quittent votre ordinateur à
                    chaque création de CV.
                  </Alert>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Service"
                      value={otherService ? OTHER_SERVICE : state.apiUrl}
                      options={[...SERVICES, { value: OTHER_SERVICE, label: 'Autre adresse' }]}
                      onChange={(v) => {
                        setOtherService(v === OTHER_SERVICE)
                        if (v !== OTHER_SERVICE) update({ apiUrl: v })
                      }}
                    />
                    <TextField
                      label="Clé personnelle (API)"
                      type="password"
                      value={key}
                      onChange={setKey}
                      placeholder={state.hasApiKey ? '•••••••••••• (enregistrée)' : ''}
                    />
                    {otherService && (
                      <TextField
                        label="Adresse du service"
                        value={state.apiUrl}
                        onChange={(v) => update({ apiUrl: v })}
                        hint="Elle commence par https:// et finit souvent par /v1."
                      />
                    )}
                    <TextField
                      label="Modèle"
                      value={state.apiModel}
                      onChange={(v) => update({ apiModel: v })}
                      hint="Le nom donné par le service, par exemple « mistral-small-latest »."
                    />
                  </div>
                  <p className="text-petit text-aide">
                    {state.hasApiKey
                      ? 'Une clé est enregistrée, chiffrée sur votre ordinateur. Elle n’est jamais réaffichée.'
                      : 'Aucune clé enregistrée pour l’instant.'}
                  </p>
                  {state.hasApiKey && (
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => void removeKey()}
                      busy={busyWith === 'key'}
                      disabled={busyWith !== null}
                    >
                      Supprimer la clé
                    </Button>
                  )}
                </>
              )}
            </EngineChoiceCard>

            <div className="rounded-carte border border-trait bg-surface px-4 py-2">
              <Checkbox
                label={<strong className="text-intro">Réécrire les phrases de mes expériences</strong>}
                hint="Désactivé : Re:CV choisit vos phrases les plus proches de l’annonce, sans les modifier. Activé : il les reformule, ce qui ajoute plusieurs minutes."
                check={state.rewriteBullets}
                onChange={(v) => void choose({ rewriteBullets: v })}
              />
            </div>

            <TextField
              label="Fichier du modèle (.gguf)"
              value={state.localModelPath ?? ''}
              onChange={(v) => update({ localModelPath: v })}
            />
          </div>
        </details>
      </Card>

      <UpdatesCard />

      <Card
        title="Mes données"
        subtitle="Votre CV, vos annonces et les CV créés sont enregistrés uniquement sur cet ordinateur."
      >
        {erasing ? (
          <div
            role="alertdialog"
            aria-labelledby="titre-effacement"
            className="space-y-3 rounded-carte border-2 border-erreur bg-erreur-fond p-5"
          >
            <h3 id="titre-effacement" className="font-titre text-intro font-bold text-erreur">
              Tout effacer définitivement ?
            </h3>
            <p className="text-corps text-encre">
              Votre CV importé, vos annonces et vos CV créés seront supprimés de Re:CV. Les fichiers déjà téléchargés
              sur votre ordinateur ne sont pas touchés. Les réglages sont gardés
              {state.hasApiKey ? ', sauf votre clé personnelle, effacée elle aussi' : ''}.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button variant="danger-filled" onClick={() => void toutEffacer()} busy={busyWith === 'erase'}>
                Oui, tout effacer
              </Button>
              <Button variant="secondary" onClick={() => setErasing(false)} disabled={busyWith !== null}>
                Non, garder mes données
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setErasing(true)}>
            Tout effacer…
          </Button>
        )}
      </Card>

      {confirmation && <Confirmation>{confirmation}</Confirmation>}
      <div className="flex flex-wrap items-center justify-end gap-4">
        {saved && hasUnsavedTextChanges(saved, state, key) && (
          <p className="flex items-center gap-2 font-bold text-alerte">
            <Icon name="warning" size={18} />
            Des modifications ne sont pas encore enregistrées.
          </p>
        )}
        <Button onClick={() => void save()} busy={busyWith === 'save'} disabled={busyWith !== null}>
          Enregistrer les réglages
        </Button>
      </div>
    </div>
  )
}
