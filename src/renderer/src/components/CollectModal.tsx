import { useEffect, useState } from 'react'
import { useStore, imageUrl } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { Modal, ModalRoot } from './ui/modal'
import { TextField } from './ui/field'
import { ImageWithSkeleton } from './ui/image'
import { cn } from '@/lib/utils'
import type { Generation, Message } from '@shared/types'

interface Props {
  /** Imagen desde la que se abrio el modal. */
  generation: Generation
  /** Mensaje al que pertenece: de ahi salen los parametros de la coleccion. */
  message: Message
  onClose: () => void
}

/**
 * Guarda una o varias imagenes en una coleccion.
 *
 * Se abre desde el "+" de una imagen del chat. Ademas de esa imagen deja
 * elegir otras de la misma conversacion, que es el caso habitual: se genera
 * un lote, se miran, y recien despues se decide cuales valen la pena.
 */
export default function CollectModal({ generation, message, onClose }: Props): React.JSX.Element {
  const collections = useStore((s) => s.collections)
  const messages = useStore((s) => s.messages)
  const createCollection = useStore((s) => s.createCollection)
  const refreshCollections = useStore((s) => s.refreshCollections)

  const [selected, setSelected] = useState<string[]>([generation.id])
  const [creating, setCreating] = useState(collections.length === 0)
  const [name, setName] = useState('')
  const [lockSeed, setLockSeed] = useState(true)
  const [already, setAlready] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.geni.collections.forGeneration(generation.id).then(setAlready)
  }, [generation.id])

  // Todas las imagenes de la conversacion abierta, la mas nueva primero.
  const available = messages
    .flatMap((m) => m.generations.map((g) => ({ generation: g, message: m })))
    .reverse()

  function toggle(id: string): void {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function saveInto(collectionId: string): Promise<void> {
    if (selected.length === 0) {
      setError('Elige al menos una imagen')
      return
    }
    setBusy(true)
    try {
      await window.geni.collections.add(collectionId, selected)
      await refreshCollections()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function createAndSave(): Promise<void> {
    if (!name.trim()) {
      setError('Ponle un nombre a la coleccion')
      return
    }
    setBusy(true)
    try {
      const collection = await createCollection({
        name: name.trim(),
        // La coleccion hereda la receta de esta generacion: es lo que
        // despues permite abrir una conversacion que siga la misma linea.
        fromMessageId: message.id,
        promptTemplate: message.prompt,
        negativeTemplate: message.negative,
        lockedSeed: lockSeed ? generation.seed : null
      })
      await window.geni.collections.add(collection.id, selected)
      await refreshCollections()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <ModalRoot isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal
        title={creating ? 'Nueva coleccion' : 'Guardar en coleccion'}
        size="lg"
        footer={
          creating ? (
            <>
              {collections.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setCreating(false)}>
                  Volver
                </Button>
              )}
              <Button size="sm" loading={busy} onClick={() => void createAndSave()}>
                Crear y guardar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" icon="add" onClick={() => setCreating(true)}>
              Nueva coleccion
            </Button>
          )
        }
      >
        {/* Que imagenes se guardan */}
        <p className="mb-2 text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
          Imagenes ({selected.length})
        </p>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {available.map(({ generation: g }) => {
            const on = selected.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggle(g.id)}
                className={cn(
                  'relative h-20 w-20 shrink-0 overflow-hidden rounded-box border-2 transition-colors',
                  on ? 'border-cobalt-500' : 'border-transparent opacity-55 hover:opacity-100'
                )}
              >
                <ImageWithSkeleton
                  src={imageUrl(g.absPath)}
                  alt=""
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                />
                {on && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-cta text-white">
                    <Icon name="check" className="text-[13px]" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {creating ? (
          <>
            <TextField
              label="Nombre"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Retratos en blanco y negro"
            />

            <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-box border border-line/60 p-3">
              <input
                type="checkbox"
                checked={lockSeed}
                onChange={(e) => setLockSeed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[13px] font-bold text-ink-800">
                  Fijar la semilla ({generation.seed})
                </span>
                <span className="block text-[11.6px] leading-snug text-ink-500">
                  Las conversaciones que abras desde esta coleccion arrancan con esta semilla, que
                  es lo que mantiene el mismo aire entre imagenes. Puedes cambiarlo despues.
                </span>
              </span>
            </label>

            <p className="text-[11.6px] leading-snug text-ink-400">
              La coleccion tambien guarda el modelo, las LoRAs y el resto de los parametros de esta
              generacion, y los prompts como plantilla.
            </p>
          </>
        ) : (
          <div className="grid gap-1.5">
            {collections.map((c) => {
              const contains = already.includes(c.id)
              return (
                <button
                  key={c.id}
                  disabled={busy}
                  onClick={() => void saveInto(c.id)}
                  className="flex items-center gap-3 rounded-box border border-line/60 bg-white/60 p-2 text-left transition-colors hover:border-cobalt-500/50 hover:bg-white disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  {c.cover ? (
                    <ImageWithSkeleton
                      src={imageUrl(c.cover)}
                      alt=""
                      wrapperClassName="h-11 w-11 shrink-0 overflow-hidden rounded-chip"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-chip bg-fog/25">
                      <Icon name="collections_bookmark" className="text-[18px] text-ink-300" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink-800">
                      {c.name}
                    </span>
                    <span className="block text-[11.6px] text-ink-400">
                      {c.itemCount} {c.itemCount === 1 ? 'imagen' : 'imagenes'}
                      {contains && ' · ya contiene esta'}
                    </span>
                  </span>
                  <Icon
                    name={contains ? 'check_circle' : 'add'}
                    className={cn('text-[18px]', contains ? 'text-green' : 'text-ink-400')}
                  />
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] font-semibold text-rose-text">
            <Icon name="error" filled className="mt-px text-[15px]" />
            {error}
          </p>
        )}
      </Modal>
    </ModalRoot>
  )
}
