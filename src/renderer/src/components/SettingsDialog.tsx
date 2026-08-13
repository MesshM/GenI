import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { Modal } from './ui/modal'
import { Section, Switch, TextField } from './ui/field'
import { cn } from '@/lib/utils'
import { applyTheme } from '@/lib/theme'
import type { AppSettings } from '@shared/types'

const THEMES: { value: AppSettings['theme']; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'dark', label: 'Oscuro', icon: 'dark_mode' }
]

export default function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const refreshSettings = useStore((s) => s.refreshSettings)

  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.geni.app.version().then(setVersion)
  }, [])

  // Si los ajustes cambian por fuera (por ejemplo tras el onboarding), se refresca.
  useEffect(() => setDraft(settings), [settings])

  const current = draft

  async function save(): Promise<void> {
    if (!current) return
    setError(null)
    try {
      await refreshSettings(current)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function browse(): Promise<void> {
    if (!current) return
    const chosen = await window.geni.settings.pickComfyFolder()
    if (chosen) setDraft({ ...current, comfyPath: chosen })
  }

  return (
    <Modal
      title="Ajustes"
      size="md"
      footer={
        <>
          <span className="mr-auto text-[11px] font-semibold text-ink-400">GenI {version}</span>
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
        </>
      }
    >
      {!current ? (
        <p className="text-[13px] text-ink-400">Cargando...</p>
      ) : (
        <>
          <Section title="Apariencia">
            <div className="mb-4 grid grid-cols-2 gap-2">
              {THEMES.map((t) => {
                const active = current.theme === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      setDraft({ ...current, theme: t.value })
                      // Se aplica al instante para poder verlo antes de guardar.
                      applyTheme(t.value)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-box border px-3 py-2.5 text-[13px] font-bold transition-colors',
                      active
                        ? 'border-cobalt-500/60 bg-tint/16 text-cobalt-700'
                        : 'border-line/60 bg-white/45 text-ink-500 hover:text-ink-700 dark:bg-white/5'
                    )}
                  >
                    <Icon name={t.icon} filled={active} className="text-[19px]" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="ComfyUI">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Carpeta
            </label>
            <div className="mb-4 flex gap-2">
              <input
                value={current.comfyPath}
                onChange={(e) => setDraft({ ...current, comfyPath: e.target.value })}
                className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/70 px-3 py-2 text-[13px] text-ink-800 outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14 dark:bg-white/5"
              />
              <Button
                size="sm"
                variant="secondary"
                icon="folder_open"
                onClick={() => void browse()}
              >
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
            <p className="-mt-1 mb-3 text-[11px] leading-snug text-ink-500">
              Solo hacen falta para bajar modelos con licencia restringida. Se guardan en tu
              equipo, en la base local de la app.
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
            <p className="flex items-start gap-1.5 text-[12px] font-semibold text-rose-text">
              <Icon name="error" filled className="mt-px text-[15px]" />
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
