import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PARAMS_MAX, PARAMS_MIN, useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Section, Slider, TextArea } from './ui/field'
import { Select } from './ui/select'
import { TranslateButton } from './ui/translate-button'
import { Resizer } from './ui/resizer'
import { ParamFields } from './ParamFields'
import { cn } from '@/lib/utils'

export default function ParamsPanel(): React.JSX.Element {
  const recipes = useStore((s) => s.recipes)
  const recipeId = useStore((s) => s.recipeId)
  const params = useStore((s) => s.params)
  const negative = useStore((s) => s.negative)
  const models = useStore((s) => s.models)
  const presets = useStore((s) => s.presets)
  const chooseRecipe = useStore((s) => s.chooseRecipe)
  const applyPreset = useStore((s) => s.applyPreset)
  const patchParams = useStore((s) => s.patchParams)
  const setNegative = useStore((s) => s.setNegative)
  const addLora = useStore((s) => s.addLora)
  const removeLora = useStore((s) => s.removeLora)
  const patchLora = useStore((s) => s.patchLora)
  const setView = useStore((s) => s.setView)

  const width = useStore((s) => s.paramsWidth)
  const setWidth = useStore((s) => s.setParamsWidth)

  const [picking, setPicking] = useState(false)
  const [presetChoice, setPresetChoice] = useState('')
  // Con un preset cargado los parametros ya estan resueltos y el panel es
  // ruido; se pliegan solos y se vuelven a abrir con el ojo.
  const [showParams, setShowParams] = useState(true)
  const recipe = recipes.find((r) => r.id === recipeId)

  // Solo se ofrecen presets cuyo modelo siga instalado: uno huerfano no se
  // puede cargar (no hay receta a la que aplicarle los parametros).
  const availablePresets = presets.filter((p) => recipes.some((r) => r.id === p.recipeId))

  /**
   * Solo se ofrecen LoRAs compatibles con el modelo elegido. La
   * arquitectura de cada LoRA se deduce al importarla (metadatos del
   * entrenador, nombres de tensores y, si no, el ancho del vector de
   * contexto: 768 en SD 1.5, 2048 en SDXL, 4096 en FLUX).
   *
   * Las que quedan en 'unknown' no se esconden: no se pudo probar que
   * sean incompatibles, y ocultarlas haria desaparecer LoRAs que
   * funcionan. Se marcan en la lista para que se sepa.
   */
  const availableLoras = useMemo(() => {
    if (!recipe || !params) return []
    return models.filter(
      (m) =>
        m.kind === 'lora' &&
        (m.architecture === recipe.baseArchitecture || m.architecture === 'unknown') &&
        !params.loras.some((l) => l.modelId === m.id)
    )
  }, [models, recipe, params])

  if (!recipe || !params) {
    return (
      <aside className="shrink-0 p-4" style={{ width }}>
        <div className="glass p-6 text-center">
          <Icon name="deployed_code" className="text-[39.9px] text-ink-300" />
          <p className="mt-2 text-[13.7px] font-bold text-ink-700">No hay modelos instalados</p>
          <p className="mt-1 text-[12.6px] leading-snug text-ink-500">
            Agrega un checkpoint desde la seccion Modelos y aparecera aca.
          </p>
          <button
            onClick={() => setView('models')}
            className="mt-4 text-[12.6px] font-bold text-cobalt-600 underline"
          >
            Ir a Modelos
          </button>
        </div>
      </aside>
    )
  }

  const isFlux = recipe.architecture !== 'sdxl'
  const isEdit = recipe.architecture === 'flux-kontext'

  return (
    <>
      <aside className="shrink-0 py-4 pl-4" style={{ width }}>
        <div className="glass scroll h-full p-5">
        {/* 1. Modelo */}
        <Section
          title="Modelo"
          tip="El checkpoint o modelo base que genera la imagen. Cada uno tiene su propio estilo y arquitectura."
        >
          <Select
            value={recipe.id}
            options={recipes.map((r) => ({ value: r.id, label: r.name }))}
            onChange={chooseRecipe}
          />
          <p className="-mt-2 text-[11.6px] leading-snug text-ink-500">{recipe.description}</p>
        </Section>

        {/* Preset guardado, justo debajo de Modelo */}
        {availablePresets.length > 0 && (
          <Section
            title="Preset"
            tip="Carga una configuracion guardada: modelo, LoRAs, muestreo y prompt negativo de una."
          >
            <Select
              value={presetChoice}
              placeholder="Sin preset"
              options={[
                { value: '', label: 'Sin preset (parametros actuales)' },
                ...availablePresets.map((p) => ({ value: p.id, label: p.name }))
              ]}
              onChange={(id) => {
                setPresetChoice(id)
                if (id) applyPreset(id)
                // Al cargar un preset los parametros quedan definidos por el
                // preset: se pliegan para dejar el panel limpio. Al volver a
                // "sin preset" se muestran de nuevo, que es cuando importan.
                setShowParams(!id)
              }}
            />
          </Section>
        )}

        {/* 2. LoRAs, justo debajo del modelo */}
        <Section
          title={`LoRAs${params.loras.length ? ` · ${params.loras.length}` : ''}`}
          tip="Ajustes finos que se suman al modelo base: cambian estilo, expresion, o corrigen detalles como las manos."
          action={
            <button
              onClick={() => setPicking((v) => !v)}
              disabled={availableLoras.length === 0}
              className="flex items-center gap-1 rounded-full border border-line/70 bg-white/70 px-2.5 py-1 text-[11.6px] font-bold text-cobalt-600 shadow-soft transition-colors hover:bg-white disabled:opacity-40 dark:bg-white/6 dark:hover:bg-white/10"
            >
              <Icon name="add" className="text-[14.7px]" />
              Agregar
            </button>
          }
        >
          {picking && availableLoras.length > 0 && (
            <div className="mb-3 max-h-52 overflow-y-auto rounded-box border border-line/60 bg-white/80 p-1.5 shadow-soft dark:bg-white/6">
              {availableLoras.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    addLora(m.id)
                    setPicking(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-chip px-2 py-1.5 text-left transition-colors hover:bg-tint/12"
                >
                  <Icon name="layers" className="shrink-0 text-[16.8px] text-cobalt-500" />
                  <span className="min-w-0 flex-1 truncate text-[12.6px] font-semibold text-ink-800">
                    {m.filename.replace(/\.[^.]+$/, '')}
                  </span>
                  {m.architecture === 'unknown' && (
                    <Icon
                      name="help"
                      className="shrink-0 text-[14.7px] text-amber"
                      title="No se pudo confirmar para que modelo es esta LoRA. Puede que no funcione con el modelo elegido."
                    />
                  )}
                  {m.triggerWords.length > 0 && (
                    <Icon
                      name="label"
                      className="shrink-0 text-[14.7px] text-ink-400"
                      title={`Trigger: ${m.triggerWords.join(', ')}`}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {params.loras.length === 0 && !picking && (
            <p className="rounded-box border border-dashed border-line/70 px-3 py-4 text-center text-[11.6px] leading-snug text-ink-400">
              {availableLoras.length === 0
                ? 'No hay LoRAs compatibles instaladas'
                : 'Sin LoRAs. Agregalas con el boton de arriba.'}
            </p>
          )}

          {params.loras.map((lora) => {
            const model = models.find((m) => m.id === lora.modelId)
            return (
              <div
                key={lora.modelId}
                className={cn(
                  'mb-2 rounded-box border p-2.5 transition-colors',
                  lora.enabled
                    ? 'border-white/80 bg-white/70 shadow-soft dark:border-white/10 dark:bg-white/6'
                    : 'border-line/50 bg-white/30 opacity-60 dark:bg-white/3'
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <button
                    onClick={() => patchLora(lora.modelId, { enabled: !lora.enabled })}
                    className="shrink-0"
                    title={lora.enabled ? 'Desactivar' : 'Activar'}
                  >
                    <Icon
                      name={lora.enabled ? 'check_circle' : 'radio_button_unchecked'}
                      filled={lora.enabled}
                      className={cn(
                        'text-[18.9px]',
                        lora.enabled ? 'text-cobalt-600' : 'text-ink-300'
                      )}
                    />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[12.6px] font-bold text-ink-800">
                    {lora.label}
                  </span>
                  <button
                    onClick={() => removeLora(lora.modelId)}
                    title="Quitar"
                    className="shrink-0 text-ink-300 transition-colors hover:text-rose"
                  >
                    <Icon name="close" className="text-[16.8px]" />
                  </button>
                </div>

                {lora.enabled && (
                  <>
                    <Slider
                      dense
                      label="Intensidad"
                      tip="Cuanto pesa esta LoRA sobre el resultado. Mas alto, mas notorio su efecto."
                      value={lora.strength}
                      min={0}
                      max={1.5}
                      step={0.05}
                      onChange={(strength) => patchLora(lora.modelId, { strength })}
                    />

                    {/* Trigger words: se anteponen al prompt al generar. */}
                    {model && model.triggerWords.length > 0 && (
                      <div className="mt-1.5">
                        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-400">
                          Trigger words
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {model.triggerWords.map((word) => {
                            const active = lora.triggers.includes(word)
                            return (
                              <button
                                key={word}
                                onClick={() =>
                                  patchLora(lora.modelId, {
                                    triggers: active
                                      ? lora.triggers.filter((w) => w !== word)
                                      : [...lora.triggers, word]
                                  })
                                }
                                title={
                                  active
                                    ? 'Se agrega al prompt. Clic para quitarla.'
                                    : 'Clic para agregarla al prompt. Se pueden activar varias.'
                                }
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10.5px] font-bold transition-colors',
                                  active
                                    ? 'bg-cta text-white shadow-blue'
                                    : 'border border-line/70 bg-white/60 text-ink-500 hover:text-cobalt-600 dark:bg-white/5'
                                )}
                              >
                                {word}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </Section>

        {/* 3. Prompt negativo */}
        {!isFlux && (
          <Section
            title="Prompt negativo"
            tip="Lo que no quieres ver en la imagen. El modelo evita estos elementos."
            action={<TranslateButton text={negative} onTranslated={setNegative} />}
          >
            <TextArea
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
              rows={3}
              placeholder="worst quality, bad anatomy, bad hands..."
            />
          </Section>
        )}

        {/* 4-6. Resolucion, muestreo y semilla (compartidos con el
             dialogo de nuevo preset, para que no se desincronicen) */}
        <div className="mb-3 flex items-center gap-2">
          <span className="h-px flex-1 bg-line/60" />
          <button
            onClick={() => setShowParams((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-line/60 bg-white/60 px-2.5 py-1 text-[11px] font-bold text-ink-500 transition-colors hover:text-cobalt-600 dark:bg-white/5"
          >
            <Icon
              name={showParams ? 'visibility_off' : 'visibility'}
              className="text-[14px]"
            />
            {showParams ? 'Ocultar parametros' : 'Ver parametros'}
          </button>
          <span className="h-px flex-1 bg-line/60" />
        </div>

        <AnimatePresence initial={false}>
          {showParams && (
            <motion.div
              key="params"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <ParamFields
                recipe={recipe}
                params={params}
                patchParams={patchParams}
                hideResolution={isEdit}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </aside>

      <Resizer
        width={width}
        onResize={setWidth}
        min={PARAMS_MIN}
        max={PARAMS_MAX}
        side="right"
      />
    </>
  )
}
