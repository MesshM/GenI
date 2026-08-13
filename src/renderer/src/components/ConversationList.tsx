import { useState } from 'react'
import { useStore, imageUrl } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export default function ConversationList(): React.JSX.Element {
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const recipes = useStore((s) => s.recipes)
  const select = useStore((s) => s.selectConversation)
  const create = useStore((s) => s.newConversation)
  const remove = useStore((s) => s.removeConversation)
  const rename = useStore((s) => s.renameConversation)

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const visible = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase())
  )

  function commitRename(): void {
    if (editing && draft.trim()) void rename(editing, draft.trim())
    setEditing(null)
  }

  return (
    <aside className="w-[268px] shrink-0 p-4 pl-2">
      <div className="glass flex h-full flex-col p-3">
        <Button fullWidth size="sm" icon="add" onClick={() => void create()}>
          Nueva conversacion
        </Button>

        <div className="relative mt-2.5">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-ink-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full rounded-chip border border-line/60 bg-white/70 py-1.5 pl-8 pr-2 text-[12px] outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14"
          />
        </div>

        <div className="scroll mt-2.5 flex-1">
          {visible.length === 0 && (
            <p className="px-2 py-8 text-center text-[12px] leading-snug text-ink-400">
              {conversations.length === 0 ? 'Todavia no hay conversaciones' : 'Nada coincide'}
            </p>
          )}

          {visible.map((c) => {
            const recipe = recipes.find((r) => r.id === c.presetId)
            const active = c.id === activeId

            return (
              <div
                key={c.id}
                onClick={() => void select(c.id)}
                className={cn(
                  'group mb-1.5 cursor-pointer rounded-box border p-2 transition-all duration-200',
                  active
                    ? 'border-white/85 bg-white/85 shadow-soft'
                    : 'border-transparent hover:bg-white/50'
                )}
              >
                <div className="flex gap-2">
                  {c.thumbnail ? (
                    <img
                      src={imageUrl(c.thumbnail)}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-chip object-cover shadow-soft"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-chip bg-fog/25">
                      <Icon name="image" className="text-[18px] text-ink-300" />
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
                        className="w-full rounded border border-cobalt-500 bg-white px-1 text-[12px] outline-none"
                      />
                    ) : (
                      <p
                        className={cn(
                          'truncate text-[12px] font-bold',
                          active ? 'text-cobalt-700' : 'text-ink-800'
                        )}
                      >
                        {c.title}
                      </p>
                    )}
                    <p className="truncate text-[11px] text-ink-400">
                      {recipe?.name ?? 'Modelo no disponible'} · {c.messageCount}
                    </p>
                  </div>
                </div>

                <div className="mt-1 hidden gap-2.5 pl-[52px] group-hover:flex">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(c.id)
                      setDraft(c.title)
                    }}
                    className="text-[11px] font-semibold text-ink-400 transition-colors hover:text-cobalt-600"
                  >
                    Renombrar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(c.id)
                    }}
                    className="text-[11px] font-semibold text-ink-400 transition-colors hover:text-rose"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/25 p-6 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-panel p-5 shadow-deep">
            <h3 className="text-[15px] font-extrabold text-ink-900">Borrar conversacion</h3>
            <p className="mt-2 text-[13px] leading-snug text-ink-600">
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
