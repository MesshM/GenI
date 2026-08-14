import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore, imageUrl } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { ImageWithSkeleton } from './ui/image'
import { Select } from './ui/select'
import { Modal, ModalRoot, ModalTrigger } from './ui/modal'
import { TextArea, TextField } from './ui/field'
import { cn } from '@/lib/utils'
import type { Collection, CollectionItem, Message } from '@shared/types'

export default function CollectionsView(): React.JSX.Element {
  const collections = useStore((s) => s.collections)
  const refreshCollections = useStore((s) => s.refreshCollections)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    void refreshCollections()
  }, [refreshCollections])

  const open = collections.find((c) => c.id === openId) ?? null

  return (
    <div className="scroll min-h-0 flex-1 px-6 pb-6">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <CollectionDetail collection={open} onBack={() => setOpenId(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <CollectionGrid collections={collections} onOpen={setOpenId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CollectionGrid({
  collections,
  onOpen
}: {
  collections: Collection[]
  onOpen: (id: string) => void
}): React.JSX.Element {
  const removeCollection = useStore((s) => s.removeCollection)
  const startFromCollection = useStore((s) => s.startFromCollection)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (collections.length === 0) {
    return (
      <>
        <Header title="Colecciones" action={<NewCollection />} />
        <div className="rounded-panel border border-dashed border-line/70 px-4 py-12 text-center">
          <Icon name="collections_bookmark" className="text-[34px] text-ink-300" />
          <p className="mt-2 text-[13.7px] font-bold text-ink-700">Todavia no hay colecciones</p>
          <p className="mx-auto mt-1 max-w-md text-[12.6px] leading-snug text-ink-500">
            Crea una desde aqui eligiendo una conversacion, o genera una imagen y toca el <b>+</b>{' '}
            sobre ella. La coleccion recuerda el modelo y los parametros, asi puedes seguir la
            misma linea despues.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Colecciones"
        subtitle={`${collections.length} en total`}
        action={<NewCollection />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {collections.map((c) => (
          <div
            key={c.id}
            className="group relative overflow-hidden rounded-panel border border-white/70 bg-white/55 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6"
          >
            <button onClick={() => onOpen(c.id)} className="block w-full text-left">
              <div className="flex h-36 items-center justify-center bg-fog/15">
                {c.cover ? (
                  <ImageWithSkeleton
                    src={imageUrl(c.cover)}
                    alt=""
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Icon name="collections_bookmark" className="text-[32px] text-ink-300" />
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[12.6px] font-bold text-ink-800">{c.name}</p>
                <p className="truncate text-[10.5px] text-ink-400">
                  {c.itemCount} {c.itemCount === 1 ? 'imagen' : 'imagenes'}
                  {c.lockedSeed !== null && ` · semilla ${c.lockedSeed}`}
                </p>
              </div>
            </button>

            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <IconChip
                icon="play_arrow"
                label="Nueva conversacion con esta receta"
                onClick={() => void startFromCollection(c.id)}
              />
              <IconChip icon="delete" label="Borrar" danger onClick={() => setConfirmDelete(c.id)} />
            </div>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/25 p-6 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-panel p-5 shadow-glass-lg">
            <h3 className="text-[15.8px] font-extrabold text-ink-900">Borrar coleccion</h3>
            <p className="mt-2 text-[13.7px] leading-snug text-ink-600">
              Se borra el album. Las imagenes siguen en su conversacion, no se pierde ninguna.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  void removeCollection(confirmDelete)
                  setConfirmDelete(null)
                }}
              >
                Borrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CollectionDetail({
  collection,
  onBack
}: {
  collection: Collection
  onBack: () => void
}): React.JSX.Element {
  const presets = useStore((s) => s.presets)
  const refreshCollections = useStore((s) => s.refreshCollections)
  const startFromCollection = useStore((s) => s.startFromCollection)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [prompt, setPrompt] = useState(collection.promptTemplate)
  const [negative, setNegative] = useState(collection.negativeTemplate)
  const [presetId, setPresetId] = useState(collection.presetId ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.geni.collections.items(collection.id).then(setItems)
  }, [collection.id])

  async function save(): Promise<void> {
    await window.geni.collections.update(collection.id, {
      promptTemplate: prompt,
      negativeTemplate: negative,
      presetId: presetId || null
    })
    await refreshCollections()
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  async function remove(generationId: string): Promise<void> {
    await window.geni.collections.removeItem(collection.id, generationId)
    setItems((prev) => prev.filter((i) => i.generationId !== generationId))
    await refreshCollections()
  }

  // Las imagenes se agrupan por conversacion: asi se ve de donde salio cada
  // una, que es lo que hace falta para etiquetarlas sin perderse.
  const byConversation = items.reduce<Record<string, CollectionItem[]>>((acc, item) => {
    ;(acc[item.conversationTitle] ??= []).push(item)
    return acc
  }, {})

  return (
    <>
      <div className="sticky top-0 z-10 -mx-6 mb-4 flex items-center gap-3 bg-transparent px-6 pb-3 pt-5 backdrop-blur">
        <Button size="sm" variant="ghost" iconOnly icon="arrow_back" aria-label="Volver" onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[19px] font-extrabold tracking-tight text-ink-900">
            {collection.name}
          </h2>
          <p className="text-[11.6px] text-ink-400">
            {collection.itemCount} {collection.itemCount === 1 ? 'imagen' : 'imagenes'}
            {collection.lockedSeed !== null && ` · semilla fija ${collection.lockedSeed}`}
          </p>
        </div>
        <Button size="sm" icon="auto_awesome" onClick={() => void startFromCollection(collection.id)}>
          Generar con esta receta
        </Button>
      </div>

      {/* Receta de la coleccion */}
      <section className="mb-6 rounded-panel border border-white/70 bg-white/55 p-4 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6">
        <h3 className="mb-3 text-[11.6px] font-extrabold uppercase tracking-wider text-ink-500">
          Receta de la coleccion
        </h3>

        <TextArea
          label="Plantilla de prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Lo que se carga en el prompt al abrir una conversacion desde aqui"
        />
        <TextArea
          label="Plantilla de negativo"
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
        />

        {presets.length > 0 && (
          <Select
            label="Preset asociado"
            value={presetId}
            placeholder="Usar los parametros guardados en la coleccion"
            tip="Si eliges un preset, se aplica en vez de los parametros que guardo la coleccion."
            options={[
              { value: '', label: 'Parametros de la coleccion' },
              ...presets.map((p) => ({ value: p.id, label: p.name }))
            ]}
            onChange={setPresetId}
          />
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => void save()}>
            Guardar cambios
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-[11.6px] font-bold text-green-deep">
              <Icon name="check" className="text-[14px]" />
              Guardado
            </span>
          )}
        </div>
      </section>

      {items.length === 0 ? (
        <p className="rounded-panel border border-dashed border-line/70 px-4 py-10 text-center text-[13px] text-ink-400">
          Esta coleccion todavia no tiene imagenes.
        </p>
      ) : (
        Object.entries(byConversation).map(([title, group]) => (
          <section key={title} className="mb-6">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11.6px] font-extrabold uppercase tracking-wider text-ink-500">
              <Icon name="forum" className="text-[14px]" />
              {title}
            </h3>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {group.map((item) => (
                <figure
                  key={item.id}
                  className="group/img relative overflow-hidden rounded-box bg-white/50 shadow-soft dark:bg-white/5"
                >
                  <ImageWithSkeleton
                    src={imageUrl(item.absPath)}
                    alt={item.prompt.slice(0, 80)}
                    wrapperClassName="w-full"
                    wrapperStyle={{ aspectRatio: `${item.width} / ${item.height}` }}
                    className="h-full w-full object-cover"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink-900/80 to-transparent p-2 opacity-0 transition-opacity group-hover/img:opacity-100">
                    <span className="text-[10px] font-bold text-white/90">#{item.seed}</span>
                    <button
                      onClick={() => void remove(item.generationId)}
                      title="Quitar de la coleccion"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-rose"
                    >
                      <Icon name="close" className="text-[14px]" />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}

function Header({
  title,
  subtitle,
  action
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 pt-5">
      <div>
        <h2 className="text-[19px] font-extrabold tracking-tight text-ink-900">{title}</h2>
        {subtitle && <p className="text-[11.6px] text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * Crear una coleccion desde su propia vista: aca no hay una imagen de
 * contexto, asi que primero se elige de que conversacion sale la receta y
 * despues cuales de sus imagenes entran.
 */
function NewCollection(): React.JSX.Element {
  const conversations = useStore((s) => s.conversations)
  const createCollection = useStore((s) => s.createCollection)
  const refreshCollections = useStore((s) => s.refreshCollections)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setSelected([])
      return
    }
    void window.geni.conversations.messages(conversationId).then((m) => {
      setMessages(m)
      setSelected([])
    })
  }, [conversationId])

  // Solo mensajes que llegaron a producir algo; el resto no aporta nada aca.
  const images = messages
    .flatMap((m) => m.generations.map((g) => ({ generation: g, message: m })))
    .reverse()

  async function save(): Promise<void> {
    if (!name.trim()) {
      setError('Ponle un nombre a la coleccion')
      return
    }
    setBusy(true)
    setError('')
    try {
      // La receta sale del mensaje de la primera imagen elegida; si no se
      // eligio ninguna, del ultimo mensaje de la conversacion.
      const source =
        images.find((i) => i.generation.id === selected[0])?.message ?? messages[messages.length - 1]

      const collection = await createCollection({
        name: name.trim(),
        fromMessageId: source?.id,
        promptTemplate: source?.prompt ?? '',
        negativeTemplate: source?.negative ?? ''
      })
      if (selected.length > 0) {
        await window.geni.collections.add(collection.id, selected)
      }
      await refreshCollections()
      setOpen(false)
      setName('')
      setConversationId('')
      setSelected([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalRoot isOpen={open} onOpenChange={setOpen}>
      <ModalTrigger radius={999}>
        <Button icon="add">Nueva coleccion</Button>
      </ModalTrigger>

      <Modal
        title="Nueva coleccion"
        size="lg"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" loading={busy} disabled={!name.trim()} onClick={() => void save()}>
              Crear
            </Button>
          </>
        }
      >
        <TextField
          label="Nombre"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Retratos en blanco y negro"
        />

        <Select
          label="Conversacion"
          value={conversationId}
          placeholder="Elige de donde salen las imagenes"
          tip="La coleccion hereda el modelo y los parametros de esta conversacion."
          options={conversations.map((c) => ({ value: c.id, label: c.title }))}
          onChange={setConversationId}
        />

        {conversationId && (
          <>
            <p className="mb-2 text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
              Imagenes ({selected.length})
            </p>
            {images.length === 0 ? (
              <p className="rounded-box border border-dashed border-line/70 px-3 py-6 text-center text-[12.6px] text-ink-400">
                Esa conversacion todavia no tiene imagenes.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {images.map(({ generation: g }) => {
                  const on = selected.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() =>
                        setSelected((prev) =>
                          prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                        )
                      }
                      className={cn(
                        'relative aspect-square overflow-hidden rounded-box border-2 transition-colors',
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
            )}
          </>
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

function IconChip({
  icon,
  label,
  onClick,
  danger
}: {
  icon: string
  label: string
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors',
        danger ? 'hover:bg-rose' : 'hover:bg-cobalt-600'
      )}
    >
      <Icon name={icon} className="text-[15px]" />
    </button>
  )
}
