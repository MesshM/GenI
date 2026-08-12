import { useState } from 'react'
import { useStore, imageUrl } from '../store/useStore'

export default function ConversationList(): React.JSX.Element {
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const presets = useStore((s) => s.presets)
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

  function startRename(id: string, title: string): void {
    setEditing(id)
    setDraft(title)
  }

  function commitRename(): void {
    if (editing && draft.trim()) void rename(editing, draft.trim())
    setEditing(null)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <button
          onClick={() => void create()}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Nueva conversacion
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar..."
          className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">
            {conversations.length === 0 ? 'Todavia no hay conversaciones' : 'Nada coincide'}
          </p>
        )}

        {visible.map((c) => {
          const preset = presets.find((p) => p.id === c.presetId)
          const active = c.id === activeId

          return (
            <div
              key={c.id}
              onClick={() => void select(c.id)}
              className={`group mb-1.5 cursor-pointer rounded-lg border p-2 transition-colors ${
                active
                  ? 'border-accent bg-accent-soft'
                  : 'border-transparent hover:bg-surface-2'
              }`}
            >
              <div className="flex gap-2">
                {c.thumbnail ? (
                  <img
                    src={imageUrl(c.thumbnail)}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded bg-surface-2" />
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
                      className="w-full rounded border border-accent bg-surface-2 px-1 text-xs outline-none"
                    />
                  ) : (
                    <p className="truncate text-xs font-medium">{c.title}</p>
                  )}
                  <p className="truncate text-[11px] text-muted">
                    {preset?.name ?? c.presetId} · {c.messageCount}
                  </p>
                </div>
              </div>

              <div className="mt-1 hidden gap-2 text-[11px] group-hover:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename(c.id, c.title)
                  }}
                  className="text-muted underline hover:text-text"
                >
                  Renombrar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(c.id)
                  }}
                  className="text-muted underline hover:text-danger"
                >
                  Borrar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
            <h3 className="font-medium">Borrar conversacion</h3>
            <p className="mt-2 text-sm text-muted">
              Se borra la conversacion y su historial. Las imagenes ya generadas siguen en la
              carpeta de salida de ComfyUI.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  void remove(confirmDelete)
                  setConfirmDelete(null)
                }}
                className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
