import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Section, Select, Slider, Switch, TextArea } from './ui/field'
import { cn } from '@/lib/utils'

const SAMPLERS = [
  'euler',
  'euler_ancestral',
  'dpmpp_2m',
  'dpmpp_2m_sde',
  'dpmpp_3m_sde',
  'ddim',
  'uni_pc'
].map((v) => ({ value: v, label: v }))

const SCHEDULERS = ['normal', 'karras', 'exponential', 'simple', 'beta'].map((v) => ({
  value: v,
  label: v
}))

export default function ParamsPanel(): React.JSX.Element {
  const recipes = useStore((s) => s.recipes)
  const recipeId = useStore((s) => s.recipeId)
  const params = useStore((s) => s.params)
  const negative = useStore((s) => s.negative)
  const models = useStore((s) => s.models)
  const chooseRecipe = useStore((s) => s.chooseRecipe)
  const patchParams = useStore((s) => s.patchParams)
  const setNegative = useStore((s) => s.setNegative)
  const addLora = useStore((s) => s.addLora)
  const removeLora = useStore((s) => s.removeLora)
  const patchLora = useStore((s) => s.patchLora)
  const setView = useStore((s) => s.setView)

  const [picking, setPicking] = useState(false)
  const recipe = recipes.find((r) => r.id === recipeId)

  /** Solo se ofrecen LoRAs compatibles con la arquitectura de la receta. */
  const availableLoras = useMemo(() => {
    if (!recipe || !params) return []
    const wanted = recipe.architecture === 'sdxl' ? 'sdxl' : 'flux'
    return models.filter(
      (m) =>
        m.kind === 'lora' &&
        (m.architecture === wanted || m.architecture === 'unknown') &&
        !params.loras.some((l) => l.modelId === m.id)
    )
  }, [models, recipe, params])

  if (!recipe || !params) {
    return (
      <aside className="w-[340px] shrink-0 p-4">
        <div className="glass p-6 text-center">
          <Icon name="deployed_code" className="text-[38px] text-ink-300" />
          <p className="mt-2 text-[13px] font-bold text-ink-700">No hay modelos instalados</p>
          <p className="mt-1 text-[12px] leading-snug text-ink-500">
            Agrega un checkpoint desde la seccion Modelos y aparecera aca.
          </p>
          <button
            onClick={() => setView('models')}
            className="mt-4 text-[12px] font-bold text-cobalt-600 underline"
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
    <aside className="w-[340px] shrink-0 p-4 pr-2">
      <div className="glass scroll h-full p-5">
        {/* 1. Modelo */}
        <Section title="Modelo">
          <Select
            value={recipe.id}
            options={recipes.map((r) => ({ value: r.id, label: r.name }))}
            onChange={chooseRecipe}
          />
          <p className="-mt-2 text-[11px] leading-snug text-ink-500">{recipe.description}</p>
        </Section>

        {/* 2. LoRAs, justo debajo del modelo */}
        <Section
          title={`LoRAs${params.loras.length ? ` · ${params.loras.length}` : ''}`}
          action={
            <button
              onClick={() => setPicking((v) => !v)}
              disabled={availableLoras.length === 0}
              className="flex items-center gap-1 rounded-chip border border-line/70 bg-white/70 px-2 py-1 text-[11px] font-bold text-cobalt-600 shadow-soft transition-colors hover:bg-white disabled:opacity-40 dark:bg-white/6 dark:hover:bg-white/10"
            >
              <Icon name="add" className="text-[14px]" />
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
                  <Icon name="layers" className="shrink-0 text-[16px] text-cobalt-500" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-800">
                    {m.filename.replace(/\.[^.]+$/, '')}
                  </span>
                  {m.triggerWords.length > 0 && (
                    <Icon
                      name="label"
                      className="shrink-0 text-[14px] text-ink-400"
                      title={`Trigger: ${m.triggerWords.join(', ')}`}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {params.loras.length === 0 && !picking && (
            <p className="rounded-box border border-dashed border-line/70 px-3 py-4 text-center text-[11px] leading-snug text-ink-400">
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
                        'text-[18px]',
                        lora.enabled ? 'text-cobalt-600' : 'text-ink-300'
                      )}
                    />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink-800">
                    {lora.label}
                  </span>
                  <button
                    onClick={() => removeLora(lora.modelId)}
                    title="Quitar"
                    className="shrink-0 text-ink-300 transition-colors hover:text-rose"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>

                {lora.enabled && (
                  <>
                    <Slider
                      dense
                      label="Intensidad"
                      value={lora.strength}
                      min={0}
                      max={1.5}
                      step={0.05}
                      onChange={(strength) => patchLora(lora.modelId, { strength })}
                    />

                    {/* Trigger words: se anteponen al prompt al generar. */}
                    {model && model.triggerWords.length > 0 && (
                      <div className="mt-1.5">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                          Trigger words
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {model.triggerWords.map((word) => {
                            const active = lora.trigger === word
                            return (
                              <button
                                key={word}
                                onClick={() =>
                                  patchLora(lora.modelId, {
                                    trigger: active ? undefined : word
                                  })
                                }
                                title={
                                  active
                                    ? 'Se agrega al prompt. Clic para quitarla.'
                                    : 'Clic para agregarla al prompt.'
                                }
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors',
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
          <Section title="Prompt negativo">
            <TextArea
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
              rows={3}
              placeholder="worst quality, bad anatomy, bad hands..."
            />
          </Section>
        )}

        {/* 4. Resolucion */}
        {recipe.resolutions.length > 0 && !isEdit && (
          <Section title="Resolucion">
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {recipe.resolutions.map((r) => {
                const active = params.width === r.width && params.height === r.height
                return (
                  <button
                    key={r.label}
                    onClick={() => patchParams({ width: r.width, height: r.height })}
                    className={cn(
                      'rounded-chip border px-2 py-1.5 text-left text-[11px] font-bold transition-colors',
                      active
                        ? 'border-cobalt-500/60 bg-tint/16 text-cobalt-700'
                        : 'border-line/60 bg-white/50 text-ink-600 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10'
                    )}
                  >
                    <span className="block truncate">{r.label}</span>
                    <span className="text-[10px] font-semibold text-ink-400">
                      {r.width}×{r.height}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Slider
                label="Ancho"
                value={params.width}
                min={512}
                max={2048}
                step={64}
                onChange={(width) => patchParams({ width })}
              />
              <Slider
                label="Alto"
                value={params.height}
                min={512}
                max={2048}
                step={64}
                onChange={(height) => patchParams({ height })}
              />
            </div>
          </Section>
        )}

        {/* 5. Muestreo */}
        <Section title="Muestreo">
          <Slider
            label="Pasos"
            value={params.steps}
            min={1}
            max={80}
            step={1}
            onChange={(steps) => patchParams({ steps })}
          />
          <Slider
            label={isFlux ? 'Guia' : 'CFG'}
            value={params.cfg}
            min={0}
            max={20}
            step={0.1}
            onChange={(cfg) => patchParams({ cfg })}
            hint={isFlux ? 'En FLUX este es el control util; el CFG queda en 1.' : undefined}
          />
          <Select
            label="Sampler"
            value={params.samplerName}
            options={SAMPLERS}
            onChange={(samplerName) => patchParams({ samplerName })}
          />
          <Select
            label="Scheduler"
            value={params.scheduler}
            options={SCHEDULERS}
            onChange={(scheduler) => patchParams({ scheduler })}
          />
          {params.denoise !== undefined && !isFlux && (
            <Slider
              label="Denoise del refinado"
              value={params.denoise}
              min={0}
              max={1}
              step={0.05}
              onChange={(denoise) => patchParams({ denoise })}
              hint="Cuanto reinventa la segunda pasada. Sobre 0.6 empieza a cambiar la composicion."
            />
          )}
        </Section>

        {/* 6. Semilla y lote */}
        <Section title="Semilla">
          <Switch
            label="Aleatoria en cada envio"
            checked={params.randomSeed}
            onChange={(randomSeed) => patchParams({ randomSeed })}
          />
          {!params.randomSeed && (
            <Slider
              label="Valor"
              value={params.seed}
              min={0}
              max={4294967295}
              step={1}
              onChange={(seed) => patchParams({ seed })}
            />
          )}
          <Slider
            label="Imagenes por envio"
            value={params.batchSize}
            min={1}
            max={4}
            step={1}
            onChange={(batchSize) => patchParams({ batchSize })}
          />
        </Section>
      </div>
    </aside>
  )
}
