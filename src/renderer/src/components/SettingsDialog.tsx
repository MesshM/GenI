import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

export default function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const refreshSettings = useStore((s) => s.refreshSettings)

  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.geni.app.version().then(setVersion)
  }, [])

  if (!draft) return <></>

  // A partir de aca draft ya no es null; el alias lo hace explicito para
  // TypeScript dentro de los callbacks.
  const current = draft

  async function save(): Promise<void> {
    setError(null)
    try {
      await refreshSettings(current)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function browse(): Promise<void> {
    const chosen = await window.geni.settings.pickComfyFolder()
    if (chosen) setDraft({ ...current, comfyPath: chosen })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Ajustes</h2>

        <Field label="Carpeta de ComfyUI">
          <div className="flex gap-2">
            <input
              value={draft.comfyPath}
              onChange={(e) => setDraft({ ...current, comfyPath: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={() => void browse()}
              className="shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
            >
              Buscar
            </button>
          </div>
        </Field>

        <Field label="Ejecutable de Python">
          <input
            value={draft.pythonPath}
            onChange={(e) => setDraft({ ...current, pythonPath: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="Argumentos de arranque">
          <input
            value={draft.launchArgs}
            onChange={(e) => setDraft({ ...current, launchArgs: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-accent"
          />
          <p className="mt-1 text-[11px] leading-snug text-muted">
            <code>--disable-pinned-memory</code> hace falta en este equipo mientras el archivo de
            paginacion de Windows siga desactivado.
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Host">
            <input
              value={draft.comfyHost}
              onChange={(e) => setDraft({ ...current, comfyHost: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Puerto">
            <input
              type="number"
              value={draft.comfyPort}
              onChange={(e) => setDraft({ ...current, comfyPort: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
        </div>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.autoStartComfy}
            onChange={(e) => setDraft({ ...current, autoStartComfy: e.target.checked })}
          />
          Arrancar ComfyUI al abrir GenI
        </label>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-[11px] text-muted">GenI {version}</span>
          <div className="flex gap-2">
            <button
              onClick={() => void window.geni.updates.check()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Buscar actualizaciones
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              onClick={() => void save()}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mt-4">
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  )
}
