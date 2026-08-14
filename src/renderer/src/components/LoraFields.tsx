import { useMemo, useState } from 'react'
import { Icon } from './ui/icon'
import { Section, Slider } from './ui/field'
import { cn } from '@/lib/utils'
import type { GenerationParams, LoraSetting, ModelAsset, Recipe } from '@shared/types'

/**
 * Agregar, sacar y ajustar LoRAs sobre unos parametros.
 *
 * Vive aparte porque la usan dos pantallas: el panel de Generar y el
 * dialogo de "nuevo preset". El preset guarda las LoRAs activas igual que
 * cualquier otro parametro, asi que tiene que poder tocarlas, no solo
 * mostrarlas.
 */

interface Props {
  recipe: Recipe
  params: GenerationParams
  models: ModelAsset[]
  addLora: (modelId: string) => void
  removeLora: (modelId: string) => void
  patchLora: (modelId: string, patch: Partial<LoraSetting>) => void
}

export function LoraFields({
  recipe,
  params,
  models,
  addLora,
  removeLora,
  patchLora
}: Props): React.JSX.Element {
  const [picking, setPicking] = useState(false)

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
  const availableLoras = useMemo(
    () =>
      models.filter(
        (m) =>
          m.kind === 'lora' &&
          (m.architecture === recipe.baseArchitecture || m.architecture === 'unknown') &&
          !params.loras.some((l) => l.modelId === m.id)
      ),
    [models, recipe, params]
  )

  return (
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
                  className={cn('text-[18.9px]', lora.enabled ? 'text-cobalt-600' : 'text-ink-300')}
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
  )
}
