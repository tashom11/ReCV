import type { ModelsState, Settings, SettingsState } from '@core/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, type ErrorDescription } from '../errors'
import { texts } from '../i18n'
import { hasUnsavedTextChanges } from '../settingsDraft'
import { Button, Card, Checkbox, Confirmation, ErrorAlert, Icon, PageTitle, Pill } from '../ui'
import { DiagnosticsCard } from './settings/DiagnosticsCard'
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
        {error ? (
          <ErrorAlert description={error} onAction={() => undefined} />
        ) : (
          <p role="status">{texts.settings.loading}</p>
        )}
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
      setConfirmation(state.hasApiKey && !after.hasApiKey ? texts.settings.savedKeyCleared : texts.settings.saved)
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
      setConfirmation(texts.settings.keyRemoved)
    } catch (e) {
      setError(describeError('settings', e))
    } finally {
      setBusyWith(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <PageTitle subtitle={texts.settings.subtitle}>{texts.settings.title}</PageTitle>
      {error && <ErrorAlert description={error} onAction={() => setError(null)} />}

      <Card title={texts.settings.engine.title} subtitle={texts.settings.engine.subtitle}>
        {/* One radio group for the three engines, two of which are in the collapsed advanced options. */}
        <fieldset className="space-y-4">
          <legend className="sr-only">{texts.settings.engine.legend}</legend>
          <EngineChoiceCard
            chosen={local}
            onChoose={() => void choose({ provider: 'local' })}
            title={texts.settings.engine.local}
            label={<Pill variant="recommended">{texts.settings.engine.recommended}</Pill>}
            description={texts.settings.engine.localDescription}
            highlighted
          >
            {local && (
              <p className={`flex items-center gap-2 pl-[34px] font-bold ${ready ? 'text-marque' : 'text-alerte'}`}>
                <Icon name={ready ? 'check-circle' : 'warning'} size={18} />
                {ready ? texts.settings.engine.ready : texts.settings.engine.missing}
              </p>
            )}
          </EngineChoiceCard>

          <ModelLevels activePath={state.localModelPath} onActive={onActiveModel} onState={onModelsState} />

          <details open={!local} className="group rounded-carte border border-trait bg-papier">
            <summary className="flex min-h-16 items-center gap-4 rounded-carte px-5 py-3">
              <span className="flex-1">
                <span className="block font-titre text-intro font-bold">{texts.settings.engine.advanced}</span>
                <span className="block text-petit text-aide">{texts.settings.engine.advancedHint}</span>
              </span>
              <Icon name="chevron-down" className="transition-transform duration-(--duree) group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-5 pb-5">
              <EngineChoiceCard
                chosen={state.provider === 'ollama'}
                onChoose={() => void choose({ provider: 'ollama' })}
                title={texts.settings.engine.ollama}
                description={texts.settings.engine.ollamaDescription}
              >
                {state.provider === 'ollama' && <OllamaFields settings={state} update={update} />}
              </EngineChoiceCard>

              <EngineChoiceCard
                chosen={state.provider === 'api'}
                onChoose={() => void choose({ provider: 'api' })}
                title={texts.settings.engine.online}
                description={texts.settings.engine.onlineDescription}
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
                  label={<strong className="text-intro">{texts.settings.engine.rewrite}</strong>}
                  hint={texts.settings.engine.rewriteHint}
                  check={state.rewriteBullets}
                  onChange={(v) => void choose({ rewriteBullets: v })}
                />
              </div>

              {/* Chosen with the native picker only (SEC-08): native code loads this file. */}
              <div className="space-y-2 rounded-carte border border-trait bg-surface px-4 py-3">
                <p id="model-file-label" className="text-corps font-bold text-encre">
                  {texts.settings.engine.modelFile}
                </p>
                <p className="break-all text-petit text-encre-douce">
                  {state.localModelPath || texts.settings.engine.noModelFile}
                </p>
                <Button
                  variant="secondary"
                  size="small"
                  icon="folder"
                  ariaLabel={`${texts.settings.engine.chooseModelFile} ${texts.settings.engine.modelFile}`}
                  onClick={() =>
                    void window.api.chooseModelFile().then(
                      (path) => {
                        if (path) void choose({ localModelPath: path })
                      },
                      (e) => setError(describeError('settings', e)),
                    )
                  }
                >
                  {texts.settings.engine.chooseModelFile}
                </Button>
                <p className="text-petit text-aide">{texts.settings.engine.modelFileWarning}</p>
              </div>
            </div>
          </details>
        </fieldset>
      </Card>

      <UpdatesCard />

      <DiagnosticsCard />

      <EraseDataCard hasApiKey={state.hasApiKey} onErased={onErased} onError={setError} />

      {confirmation && <Confirmation>{confirmation}</Confirmation>}
      <div className="flex flex-wrap items-center justify-end gap-4">
        {saved && hasUnsavedTextChanges(saved, state, key) && (
          <p className="flex items-center gap-2 font-bold text-alerte">
            <Icon name="warning" size={18} />
            {texts.settings.unsaved}
          </p>
        )}
        <Button onClick={() => void save()} busy={busyWith === 'save'} disabled={busyWith !== null}>
          {texts.settings.save}
        </Button>
      </div>
    </div>
  )
}
