import { useStore } from '../store/useStore'
import { Section, Select, Slider } from './Field'

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
  const presets = useStore((s) => s.presets)
  const presetId = useStore((s) => s.presetId)
  const params = useStore((s) => s.params)
  const negative = useStore((s) => s.negative)
  const choosePreset = useStore((s) => s.choosePreset)
  const patchParams = useStore((s) => s.patchParams)
  const setNegative = useStore((s) => s.setNegative)

  const preset = presets.find((p) => p.id === presetId)

  if (!preset || !params) {
    return <aside className="w-80 shrink-0 border-r border-border bg-surface" />
  }

  const isFlux = preset.id.startsWith('flux')

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-surface p-4">
      <Section title="Modelo">
        <Select
          label="Preset"
          value={preset.id}
          options={presets.map((p) => ({ value: p.id, label: p.name }))}
          onChange={choosePreset}
        />
        <p className="-mt-2 text-[11px] leading-snug text-muted">{preset.description}</p>
      </Section>

      {preset.kind === 'txt2img' && (
        <Section title="Prompt negativo">
          <textarea
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            rows={3}
            placeholder={
              isFlux ? 'FLUX lo ignora' : 'worst quality, bad anatomy, bad hands...'
            }
            disabled={isFlux}
            className="w-full resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-xs outline-none focus:border-accent disabled:opacity-40"
          />
        </Section>
      )}

      {preset.resolutions.length > 0 && (
        <Section title="Resolucion">
          <Select
            label="Preajuste"
            value={`${params.width}x${params.height}`}
            options={[
              ...preset.resolutions.map((r) => ({
                value: `${r.width}x${r.height}`,
                label: `${r.label} — ${r.width}x${r.height}`
              })),
              { value: `${params.width}x${params.height}`, label: 'Personalizada' }
            ].filter(
              (o, i, arr) => arr.findIndex((x) => x.value === o.value) === i
            )}
            onChange={(v) => {
              const [width, height] = v.split('x').map(Number)
              patchParams({ width, height })
            }}
          />
          <div className="grid grid-cols-2 gap-2">
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
          value={params.steps}
          min={1}
          max={80}
          step={1}
          onChange={(steps) => patchParams({ steps })}
        />
        <Slider
          label={isFlux ? 'Guia (guidance)' : 'CFG'}
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
        {params.denoise !== undefined && (
          <Slider
            label="Denoise del refinado"
            value={params.denoise}
            min={0}
            max={1}
            step={0.05}
            onChange={(denoise) => patchParams({ denoise })}
            hint="Cuanto reinventa la segunda pasada. Por encima de 0.6 empieza a cambiar la composicion."
          />
        )}
      </Section>

      <Section title="Semilla">
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={params.randomSeed}
            onChange={(e) => patchParams({ randomSeed: e.target.checked })}
          />
          Aleatoria en cada generacion
        </label>
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
      </Section>

      {params.loras.length > 0 && (
        <Section title="LoRAs">
          {params.loras.map((lora, i) => (
            <div key={lora.node} className="mb-3 rounded-lg border border-border bg-surface-2 p-2.5">
              <label className="mb-2 flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={lora.enabled}
                  onChange={(e) => {
                    const loras = [...params.loras]
                    loras[i] = { ...lora, enabled: e.target.checked }
                    patchParams({ loras })
                  }}
                />
                {lora.label}
              </label>
              {lora.enabled && (
                <>
                  <Slider
                    label="Fuerza"
                    value={lora.strength}
                    min={0}
                    max={1.5}
                    step={0.05}
                    onChange={(strength) => {
                      const loras = [...params.loras]
                      loras[i] = { ...lora, strength }
                      patchParams({ loras })
                    }}
                  />
                  {lora.trigger && (
                    <p className="text-[11px] text-muted">
                      Se agrega <code className="text-accent">{lora.trigger}</code> al prompt
                      automaticamente.
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </Section>
      )}

      <Section title="Lote">
        <Slider
          label="Imagenes por envio"
          value={params.batchSize}
          min={1}
          max={4}
          step={1}
          onChange={(batchSize) => patchParams({ batchSize })}
        />
      </Section>
    </aside>
  )
}
