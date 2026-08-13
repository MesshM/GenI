import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { Section, Switch, TextField } from './ui/field'

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/25 p-6 backdrop-blur-sm">
      <div className="glass-strong scroll max-h-[86vh] w-full max-w-lg animate-pop-in rounded-panel p-6 shadow-deep">
        <h2 className="mb-5 text-[19px] font-extrabold tracking-tight text-ink-900">Ajustes</h2>

        <Section title="ComfyUI">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
            Carpeta
          </label>
          <div className="mb-4 flex gap-2">
            <input
              value={current.comfyPath}
              onChange={(e) => setDraft({ ...current, comfyPath: e.target.value })}
              className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/80 px-3 py-2 text-[13px] outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14"
            />
            <Button size="sm" variant="secondary" icon="folder_open" onClick={() => void browse()}>
              Buscar
            </Button>
          </div>

          <TextField
            label="Ejecutable de Python"
            value={current.pythonPath}
            onChange={(e) => setDraft({ ...current, pythonPath: e.target.value })}
          />

          <TextField
            label="Argumentos de arranque"
            className="font-mono text-[12px]"
            value={current.launchArgs}
            onChange={(e) => setDraft({ ...current, launchArgs: e.target.value })}
            hint="--disable-pinned-memory hace falta mientras el archivo de paginacion de Windows siga desactivado."
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Host"
              value={current.comfyHost}
              onChange={(e) => setDraft({ ...current, comfyHost: e.target.value })}
            />
            <TextField
              label="Puerto"
              type="number"
              value={current.comfyPort}
              onChange={(e) => setDraft({ ...current, comfyPort: Number(e.target.value) })}
            />
          </div>

          <Switch
            label="Arrancar ComfyUI al abrir GenI"
            checked={current.autoStartComfy}
            onChange={(autoStartComfy) => setDraft({ ...current, autoStartComfy })}
          />
        </Section>

        <Section title="Tokens de descarga">
          <p className="mb-3 -mt-1 text-[11px] leading-snug text-ink-500">
            Solo hacen falta para bajar modelos con licencia restringida. Se guardan en tu equipo,
            en la base local de la app.
          </p>
          <TextField
            label="Civitai"
            type="password"
            placeholder="Sin token"
            value={current.civitaiToken}
            onChange={(e) => setDraft({ ...current, civitaiToken: e.target.value })}
          />
          <TextField
            label="Hugging Face"
            type="password"
            placeholder="Sin token"
            value={current.huggingFaceToken}
            onChange={(e) => setDraft({ ...current, huggingFaceToken: e.target.value })}
          />
        </Section>

        {error && (
          <p className="mb-3 flex items-start gap-1.5 text-[12px] font-semibold text-rose-text">
            <Icon name="error" filled className="mt-px text-[15px]" />
            {error}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-line/40 pt-4">
          <span className="text-[11px] font-semibold text-ink-400">GenI {version}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon="system_update"
              onClick={() => void window.geni.updates.check()}
            >
              Buscar updates
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
