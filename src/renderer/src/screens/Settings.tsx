import type { ModelsState, Settings, SettingsState } from '@core/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, type ErrorDescription } from '../errors'
import { hasUnsavedTextChanges } from '../settingsDraft'
import { Button, Card, Checkbox, Confirmation, ErrorAlert, Icon, PageTitle, Pill, TextField } from '../ui'
import { EngineChoiceCard } from './settings/EngineChoiceCard'
import { EraseDataCard } from './settings/EraseDataCard'
import { ModelLevels } from './settings/ModelLevels'
import { OllamaFields } from './settings/OllamaFields'
import { OnlineServiceFields } from './settings/OnlineServiceFields'
import { UpdatesCard } from './Updates'

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
  const [error, setError] = useState<ErrorDescription | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [busyWith, setBusyWith] = useState<'save' | 'key' | null>(null)

  useEffect(() => {
    window.api.getSettings().then(
      (p) => {
        setState(p)
        setSaved(p)
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <PageTitle subtitle="La plupart des personnes n’ont rien à changer ici.">Réglages</PageTitle>
      {error && <ErrorAlert description={error} onAction={() => setError(null)} />}

      <Card title="Moteur d’intelligence artificielle" subtitle="C’est lui qui lit votre CV et l’annonce.">
        {/* One radio group for the three engines, two of which are in the collapsed advanced options. */}
        <fieldset className="space-y-4">
          <legend className="sr-only">
            Où tourne le moteur : sur cet ordinateur, ou avec Ollama ou un service en ligne (options avancées)
          </legend>
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
                {state.provider === 'ollama' && <OllamaFields settings={state} update={update} />}
              </EngineChoiceCard>

              <EngineChoiceCard
                chosen={state.provider === 'api'}
                onChoose={() => void choose({ provider: 'api' })}
                title="Service en ligne avec ma clé personnelle"
                description="OpenAI, Mistral, OpenRouter… Rapide, mais payant selon le service."
              >
                {state.provider === 'api' && (
                  <OnlineServiceFields
                    settings={state}
                    update={update}
                    apiKey={key}
                    onApiKey={setKey}
                    onRemoveKey={() => void removeKey()}
                    removingKey={busyWith === 'key'}
                    disabled={busyWith !== null}
                  />
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
        </fieldset>
      </Card>

      <UpdatesCard />

      <EraseDataCard hasApiKey={state.hasApiKey} onErased={onErased} onError={setError} />

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
