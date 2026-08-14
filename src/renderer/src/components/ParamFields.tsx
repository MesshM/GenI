import { Section, Slider, Switch } from './ui/field'
import { Select } from './ui/select'
import { aspectRatioLabel, cn } from '@/lib/utils'
import type { GenerationParams, Recipe } from '@shared/types'

/**
 * Los controles de resolucion, muestreo y semilla.
 *
 * Viven aparte porque los usan dos pantallas: el panel de Generar y el
 * dialogo de "nuevo preset". Cuando estaban escritos solo en el panel, el
 * preset guardaba parametros que el usuario nunca habia podido ver ni
 * tocar desde ahi.
 */

export const SAMPLERS = [
  'euler',
  'euler_ancestral',
  'dpmpp_2m',
  'dpmpp_2m_sde',
  'dpmpp_3m_sde',
  'ddim',
  'uni_pc'
].map((v) => ({ value: v, label: v }))

export const SCHEDULERS = ['normal', 'karras', 'exponential', 'simple', 'beta'].map((v) => ({
  value: v,
  label: v
}))

/** Rectangulo a escala que muestra la proporcion de la resolucion. */
export function RatioShape({
  width,
  height,
  active
}: {
  width: number
  height: number
  active: boolean
}): React.JSX.Element {
  const MAX_SIDE = 24
  const scale = width >= height ? MAX_SIDE / width : MAX_SIDE / height
  const boxW = Math.max(6, Math.round(width * scale))
  const boxH = Math.max(6, Math.round(height * scale))

  return (
    <span className="flex h-6.5 items-center justify-center">
      <span
        className={cn('rounded-[3px] border-2', active ? 'border-cobalt-600' : 'border-ink-300')}
        style={{ width: boxW, height: boxH }}
      />
    </span>
  )
}

interface Props {
  recipe: Recipe
  params: GenerationParams
  patchParams: (patch: Partial<GenerationParams>) => void
  /** Los flujos de edicion (Kontext) toman el tamaño de la imagen de entrada. */
  hideResolution?: boolean
  /** En el modal las resoluciones entran de a 2 por fila, no de a 3. */
  resolutionColumns?: 2 | 3
}

export function ParamFields({
  recipe,
  params,
  patchParams,
  hideResolution,
  resolutionColumns = 3
}: Props): React.JSX.Element {
  const isFlux = recipe.architecture !== 'sdxl'

  return (
    <>
      {recipe.resolutions.length > 0 && !hideResolution && (
        <Section
          title="Resolucion"
          tip="Tamano final de la imagen. Resoluciones muy grandes tardan mas y usan mas memoria de video."
        >
          <div
            className={cn(
              'mb-3 grid gap-1.5',
              resolutionColumns === 2 ? 'grid-cols-2' : 'grid-cols-3'
            )}
          >
            {recipe.resolutions.map((r) => {
              const active = params.width === r.width && params.height === r.height
              return (
                <button
                  key={r.label}
                  title={r.label}
                  onClick={() => patchParams({ width: r.width, height: r.height })}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-chip border px-1.5 py-2 transition-colors',
                    active
                      ? 'border-cobalt-500/60 bg-tint/16'
                      : 'border-line/60 bg-white/50 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10'
                  )}
                >
                  <RatioShape width={r.width} height={r.height} active={active} />
                  <span
                    className={cn(
                      'text-[11.6px] font-extrabold',
                      active ? 'text-cobalt-700' : 'text-ink-600'
                    )}
                  >
                    {aspectRatioLabel(r.width, r.height)}
                  </span>
                  <span className="text-[9.8px] font-semibold text-ink-400">
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

      <Section title="Muestreo">
        <Slider
          label="Pasos"
          tip="Cuantas veces el modelo refina la imagen. Mas pasos, mas detalle, pero mas lento."
          value={params.steps}
          min={1}
          max={80}
          step={1}
          onChange={(steps) => patchParams({ steps })}
        />
        <Slider
          label={isFlux ? 'Guia' : 'CFG'}
          tip={
            isFlux
              ? 'Cuanto sigue el modelo tu prompt al pie de la letra.'
              : 'Cuanto sigue el modelo tu prompt. Muy alto puede saturar colores o generar artefactos.'
          }
          value={params.cfg}
          min={0}
          max={20}
          step={0.1}
          onChange={(cfg) => patchParams({ cfg })}
          hint={isFlux ? 'En FLUX este es el control util; el CFG queda en 1.' : undefined}
        />
        <Select
          label="Sampler"
          tip="El metodo matematico que usa el modelo para llegar a la imagen final. Cada uno da resultados ligeramente distintos."
          value={params.samplerName}
          options={SAMPLERS}
          onChange={(samplerName) => patchParams({ samplerName })}
        />
        <Select
          label="Scheduler"
          tip="Como se reparten los pasos a lo largo de la generacion. Afecta la nitidez y el ritmo del detalle."
          value={params.scheduler}
          options={SCHEDULERS}
          onChange={(scheduler) => patchParams({ scheduler })}
        />
        {params.denoise !== undefined && !isFlux && (
          <Slider
            label="Denoise del refinado"
            tip="Cuanto reinventa la segunda pasada sobre la imagen base."
            value={params.denoise}
            min={0}
            max={1}
            step={0.05}
            onChange={(denoise) => patchParams({ denoise })}
            hint="Sobre 0.6 empieza a cambiar la composicion."
          />
        )}
      </Section>

      <Section title="Semilla">
        <Switch
          label="Aleatoria en cada envio"
          tip="Si esta activo, cada generacion usa un numero al azar. Desactivalo para repetir siempre la misma composicion base."
          checked={params.randomSeed}
          onChange={(randomSeed) => patchParams({ randomSeed })}
        />
        {!params.randomSeed && (
          <Slider
            label="Valor"
            tip="El numero que arranca el ruido inicial. Misma semilla + mismos parametros = misma imagen."
            value={params.seed}
            min={0}
            max={4294967295}
            step={1}
            counterWidth={128}
            onChange={(seed) => patchParams({ seed })}
          />
        )}
        <Slider
          label="Imagenes por envio"
          tip="Cuantas imagenes genera cada vez que le das a Generar."
          value={params.batchSize}
          min={1}
          max={4}
          step={1}
          onChange={(batchSize) => patchParams({ batchSize })}
        />
      </Section>
    </>
  )
}
