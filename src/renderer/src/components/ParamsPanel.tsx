import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PARAMS_MAX, PARAMS_MIN, useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Section, TextArea } from './ui/field'
import { Select } from './ui/select'
import { TranslateButton } from './ui/translate-button'
import { Tooltip } from './ui/tooltip'
import { Resizer } from './ui/resizer'
import { ParamFields } from './ParamFields'
import { LoraFields } from './LoraFields'

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

  const [presetChoice, setPresetChoice] = useState('')
  // Con un preset cargado los parametros ya estan resueltos y el panel es
  // ruido; se pliegan solos y se vuelven a abrir con el ojo.
  const [showParams, setShowParams] = useState(true)
  const recipe = recipes.find((r) => r.id === recipeId)

  // Solo se ofrecen presets cuyo modelo siga instalado: uno huerfano no se
  // puede cargar (no hay receta a la que aplicarle los parametros).
  const availablePresets = presets.filter((p) => recipes.some((r) => r.id === p.recipeId))

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
        <LoraFields
          recipe={recipe}
          params={params}
          models={models}
          addLora={addLora}
          removeLora={removeLora}
          patchLora={patchLora}
        />

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
          <Tooltip text={showParams ? 'Ocultar parametros' : 'Ver parametros'}>
            <button
              onClick={() => setShowParams((v) => !v)}
              aria-label={showParams ? 'Ocultar parametros' : 'Ver parametros'}
              className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-line/60 bg-white/60 text-ink-500 transition-colors hover:text-cobalt-600 dark:bg-white/5"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showParams ? 'on' : 'off'}
                  initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
                  transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                  className="grid place-items-center"
                >
                  <Icon name={showParams ? 'visibility_off' : 'visibility'} className="text-[14px]" />
                </motion.span>
              </AnimatePresence>
            </button>
          </Tooltip>
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
