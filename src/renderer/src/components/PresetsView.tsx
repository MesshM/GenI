import { useState } from 'react'
import { useStore, imageUrl } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { ImageWithSkeleton } from './ui/image'
import { Modal, ModalRoot, ModalTrigger } from './ui/modal'
import { TextArea, TextField } from './ui/field'
import { Select } from './ui/select'
import { ParamFields } from './ParamFields'
import WorkflowImport from './WorkflowImport'
import { cn } from '@/lib/utils'

/** Etiqueta chica para resumir que entra en el preset. */
function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        'rounded-full border border-line/50 px-2 py-0.5 text-[10.5px] font-bold',
        muted ? 'text-ink-400' : 'bg-white/60 text-ink-600 dark:bg-white/6'
      )}
    >
      {children}
    </span>
  )
}

export default function PresetsView(): React.JSX.Element {
  const presets = useStore((s) => s.presets)
  const recipes = useStore((s) => s.recipes)
  const recipeId = useStore((s) => s.recipeId)
  const params = useStore((s) => s.params)
  const negative = useStore((s) => s.negative)
  const chooseRecipe = useStore((s) => s.chooseRecipe)
  const patchParams = useStore((s) => s.patchParams)
  const setNegative = useStore((s) => s.setNegative)
  const createPreset = useStore((s) => s.createPreset)
  const removePreset = useStore((s) => s.removePreset)

  const activeLoras = params?.loras.filter((l) => l.enabled) ?? []

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const currentRecipe = recipes.find((r) => r.id === recipeId)

  async function pickImage(): Promise<void> {
    const path = await window.geni.presets.pickReferenceImage()
    if (path) setImagePath(path)
  }

  async function save(): Promise<void> {
    if (!name.trim() || !currentRecipe) return
    setSaving(true)
    setError(null)
    try {
      await createPreset({ name: name.trim(), referenceImageSourcePath: imagePath ?? undefined })
      setName('')
      setImagePath(null)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string): Promise<void> {
    await removePreset(id)
    setConfirmId(null)
  }

  return (
    <main className="scroll min-w-0 flex-1 px-6 pb-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Presets</h1>
            <p className="mt-1 text-[13px] text-ink-500">
              Configuraciones guardadas con una imagen de referencia, para volver a cargarlas
              desde el select de Generar.
            </p>
          </div>

          <div className="flex items-center gap-2">
          <WorkflowImport />

          <ModalRoot isOpen={open} onOpenChange={setOpen}>
            <ModalTrigger>
              <Button icon="add" disabled={!currentRecipe}>
                Nuevo preset
              </Button>
            </ModalTrigger>

            <Modal
              title="Nuevo preset"
              footer={
                <>
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" loading={saving} disabled={!name.trim()} onClick={() => void save()}>
                    Guardar
                  </Button>
                </>
              }
            >
              <TextField
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Retrato realista, alto detalle"
                autoFocus
              />

              {/* Lo que se va a guardar, editable aca mismo. Antes el modal
                  solo pedia nombre e imagen y los parametros viajaban en
                  silencio desde la vista Generar: no habia forma de saber
                  que quedaba adentro del preset sin volver atras. */}
              <Select
                label="Modelo"
                value={recipeId ?? ''}
                options={recipes.map((r) => ({ value: r.id, label: r.name }))}
                onChange={chooseRecipe}
                tip="Cambiarlo tambien cambia el modelo activo en Generar, y reinicia los parametros a los de ese modelo."
              />

              {params && currentRecipe && (
                <>
                  {/* Los mismos controles que la vista Generar, no un
                      resumen: el preset guarda todo esto, asi que hay que
                      poder verlo y tocarlo antes de guardar. */}
                  <ParamFields
                    recipe={currentRecipe}
                    params={params}
                    patchParams={patchParams}
                    hideResolution={currentRecipe.architecture === 'flux-kontext'}
                    resolutionColumns={2}
                  />

                  <TextArea
                    label="Prompt negativo"
                    value={negative}
                    onChange={(e) => setNegative(e.target.value)}
                    rows={2}
                    placeholder="worst quality, bad anatomy..."
                  />

                  <div className="mb-4 rounded-box border border-line/50 bg-white/50 px-3 py-2.5 dark:bg-white/5">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                      LoRAs incluidas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeLoras.length > 0 ? (
                        activeLoras.map((l) => (
                          <Tag key={l.modelId}>
                            {l.label} · {l.strength}
                          </Tag>
                        ))
                      ) : (
                        <Tag muted>ninguna</Tag>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-ink-400">
                      Las LoRAs se agregan y se quitan desde la vista Generar.
                    </p>
                  </div>
                </>
              )}

              <label className="mb-1.5 block text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
                Imagen de referencia
              </label>
              <button
                type="button"
                onClick={() => void pickImage()}
                className={cn(
                  'mb-1 flex h-40 w-full items-center justify-center overflow-hidden rounded-box border-2 border-dashed transition-colors',
                  imagePath
                    ? 'border-transparent'
                    : 'border-line/70 bg-white/40 hover:border-cobalt-500/50 dark:bg-white/4'
                )}
              >
                {imagePath ? (
                  <ImageWithSkeleton
                    src={imageUrl(imagePath)}
                    alt=""
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-ink-400">
                    <Icon name="add_photo_alternate" className="text-[28px]" />
                    <span className="text-[12px] font-semibold">
                      Click para elegir una imagen
                    </span>
                  </span>
                )}
              </button>
              {imagePath && (
                <button
                  onClick={() => setImagePath(null)}
                  className="text-[11px] font-semibold text-ink-400 underline hover:text-rose"
                >
                  Quitar imagen
                </button>
              )}

              {error && (
                <p className="mt-3 flex items-start gap-1.5 text-[12px] font-semibold text-rose-text">
                  <Icon name="error" filled className="mt-px text-[15px]" />
                  {error}
                </p>
              )}
            </Modal>
          </ModalRoot>
          </div>
        </div>

        {presets.length === 0 ? (
          <p className="rounded-panel border border-dashed border-line/70 px-4 py-10 text-center text-[13px] text-ink-400">
            Todavia no hay presets. Ajusta los parametros en Generar y guardalos aca con "Nuevo
            preset".
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {presets.map((p) => {
              const available = recipes.some((r) => r.id === p.recipeId)
              return (
                <div
                  key={p.id}
                  className={cn(
                    'group relative overflow-hidden rounded-panel border border-white/70 bg-white/55 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6',
                    !available && 'opacity-60'
                  )}
                >
                  <div className="flex h-36 items-center justify-center bg-fog/15">
                    {p.referenceImagePath ? (
                      <ImageWithSkeleton
                        src={imageUrl(p.referenceImagePath)}
                        alt=""
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon name="image" className="text-[32px] text-ink-300" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[12.6px] font-bold text-ink-800">{p.name}</p>
                    <p className="truncate text-[10.5px] text-ink-400">
                      {p.recipeName}
                      {!available && ' · modelo no disponible'}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmId(p.id)}
                    title="Eliminar"
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/60 group-hover:opacity-100"
                  >
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/25 p-6 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-panel p-5 shadow-glass-lg">
            <h3 className="text-[15px] font-extrabold text-ink-900">Eliminar preset</h3>
            <p className="mt-2 text-[13px] leading-snug text-ink-600">
              Se borra la configuracion guardada y su imagen de referencia. No afecta a las
              conversaciones que ya la usaron.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                Cancelar
              </Button>
              <Button size="sm" variant="danger" onClick={() => void remove(confirmId)}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
