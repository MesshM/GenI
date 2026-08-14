import { useState } from 'react'
import { useStore, imageUrl, type View } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { ImageWithSkeleton } from './ui/image'
import { ModalRoot, ModalTrigger } from './ui/modal'
import SettingsDialog from './SettingsDialog'
import { cn } from '@/lib/utils'
import isotipo from '@/assets/icons/isotipo.png'
import logotipo from '@/assets/icons/logotipo.png'

const NAV: { view: View; icon: string; label: string }[] = [
  { view: 'chat', icon: 'auto_awesome', label: 'Generar' },
  { view: 'collections', icon: 'collections_bookmark', label: 'Colecciones' },
  { view: 'presets', icon: 'bookmark', label: 'Presets' },
  { view: 'models', icon: 'inventory_2', label: 'Modelos' }
]

/** Cada boton del sidebar es una pildora. */
const PILL =
  'flex h-[46px] items-center rounded-full pl-[11px] pr-4 text-[14.7px] font-bold transition-[background,color,box-shadow] duration-200'

/** Marco lateral plano: navegacion, historial de conversaciones y ajustes. */
export default function Sidebar(): React.JSX.Element {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const models = useStore((s) => s.models)
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const recipes = useStore((s) => s.recipes)
  const presets = useStore((s) => s.presets)
  const collections = useStore((s) => s.collections)
  const select = useStore((s) => s.selectConversation)
  const create = useStore((s) => s.newConversation)
  const remove = useStore((s) => s.removeConversation)
  const rename = useStore((s) => s.renameConversation)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function commitRename(): void {
    if (editing && draft.trim()) void rename(editing, draft.trim())
    setEditing(null)
  }

  const width = useStore((s) => s.sidebarWidth)

  return (
    <aside className="flex shrink-0 flex-col px-3 py-4" style={{ width }}>
      <div className="mb-5 flex h-12 items-center pl-2.25">
        <img src={isotipo} alt="" className="h-9 w-9 shrink-0 object-contain" />
        <img src={logotipo} alt="GenI" className="ml-2.5 h-6 w-auto object-contain" />
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const active = view === item.view
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={cn(
                PILL,
                active
                  ? 'bg-white/85 text-cobalt-700 shadow-soft dark:bg-white/10'
                  : 'text-ink-500 hover:bg-white/50 hover:text-ink-700 dark:hover:bg-white/6'
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center">
                <Icon name={item.icon} filled={active} className="text-[22.1px]" />
              </span>
              <span className="ml-3">{item.label}</span>
              {item.view === 'models' && models.length > 0 && (
                <span className="ml-auto rounded-full bg-tint/16 px-2 py-0.5 text-[11.6px] font-extrabold text-cobalt-600">
                  {models.length}
                </span>
              )}
              {item.view === 'presets' && presets.length > 0 && (
                <span className="ml-auto rounded-full bg-tint/16 px-2 py-0.5 text-[11.6px] font-extrabold text-cobalt-600">
                  {presets.length}
                </span>
              )}
              {item.view === 'collections' && collections.length > 0 && (
                <span className="ml-auto rounded-full bg-tint/16 px-2 py-0.5 text-[11.6px] font-extrabold text-cobalt-600">
                  {collections.length}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11.6px] font-extrabold uppercase tracking-wider text-ink-400">
            Conversaciones
          </span>
          <button
            onClick={() => void create()}
            title="Nueva conversacion"
            className="grid h-6 w-6 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/60 hover:text-cobalt-600 dark:hover:bg-white/8"
          >
            <Icon name="add" className="text-[17.9px]" />
          </button>
        </div>

        <div className="scroll -mx-1 flex-1 px-1">
          {conversations.length === 0 && (
            <p className="px-2 py-6 text-center text-[11.6px] leading-snug text-ink-400">
              Todavia no hay conversaciones
            </p>
          )}

          {conversations.map((c) => {
            const recipe = recipes.find((r) => r.id === c.presetId)
            const active = c.id === activeId

            return (
              <div
                key={c.id}
                onClick={() => {
                  void select(c.id)
                  setView('chat')
                }}
                className={cn(
                  'group mb-1 cursor-pointer rounded-box border p-1.5 transition-all duration-200',
                  active
                    ? 'border-white/80 bg-white/80 shadow-soft dark:border-white/10 dark:bg-white/10'
                    : 'border-transparent hover:bg-white/45 dark:hover:bg-white/6'
                )}
              >
                <div className="flex items-center gap-2">
                  {c.thumbnail ? (
                    <ImageWithSkeleton
                      src={imageUrl(c.thumbnail)}
                      alt=""
                      wrapperClassName="h-9 w-9 shrink-0 overflow-hidden rounded-chip shadow-soft"
                      skeletonClassName="rounded-chip"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-fog/25">
                      <Icon name="image" className="text-[16.8px] text-ink-300" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    {editing === c.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-cobalt-500 bg-white px-1 text-[12.6px] text-ink-900 outline-none dark:bg-white/10"
                      />
                    ) : (
                      <p
                        className={cn(
                          'truncate text-[12.6px] font-bold',
                          active ? 'text-cobalt-700' : 'text-ink-600'
                        )}
                      >
                        {c.title}
                      </p>
                    )}
                    <p className="truncate text-[10.5px] text-ink-400">
                      {recipe?.name ?? 'Modelo no disponible'}
                    </p>
                  </div>

                  <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(c.id)
                        setDraft(c.title)
                      }}
                      title="Renombrar"
                      className="grid h-6 w-6 place-items-center rounded-full text-ink-400 hover:text-cobalt-600"
                    >
                      <Icon name="edit" className="text-[14.7px]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete(c.id)
                      }}
                      title="Borrar"
                      className="grid h-6 w-6 place-items-center rounded-full text-ink-400 hover:text-rose"
                    >
                      <Icon name="delete" className="text-[14.7px]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* El boton se convierte en el modal: comparten layoutId. */}
      <ModalRoot isOpen={settingsOpen} onOpenChange={setSettingsOpen}>
        <ModalTrigger fullWidth radius={999} className="mt-2 overflow-hidden">
          <div
            className={cn(
              PILL,
              'text-ink-500 hover:bg-white/50 hover:text-ink-700 dark:hover:bg-white/6'
            )}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center">
              <Icon name="settings" className="text-[22.1px]" />
            </span>
            <span className="ml-3">Ajustes</span>
          </div>
        </ModalTrigger>

        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      </ModalRoot>

      {confirmDelete && (
        <div className="no-drag fixed inset-0 z-50 grid place-items-center bg-ink-900/25 p-6 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-panel p-5 shadow-glass-lg">
            <h3 className="text-[15.8px] font-extrabold text-ink-900">Borrar conversacion</h3>
            <p className="mt-2 text-[13.7px] leading-snug text-ink-600">
              Se borra la conversacion y su historial. Las imagenes ya generadas siguen en la
              carpeta de salida de ComfyUI.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  void remove(confirmDelete)
                  setConfirmDelete(null)
                }}
              >
                Borrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
