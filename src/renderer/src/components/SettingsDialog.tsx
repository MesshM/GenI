import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { Modal } from './ui/modal'
import { Switch, TextField } from './ui/field'
import { cn } from '@/lib/utils'
import { applyTheme } from '@/lib/theme'
import type { AppSettings } from '@shared/types'

type Group = 'apariencia' | 'comfyui' | 'apikeys' | 'acerca'

const GROUPS: { id: Group; label: string; icon: string }[] = [
  { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
  { id: 'comfyui', label: 'ComfyUI', icon: 'memory' },
  { id: 'apikeys', label: 'API Keys', icon: 'key' },
  { id: 'acerca', label: 'Acerca de', icon: 'info' }
]

const THEMES: { value: AppSettings['theme']; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'dark', label: 'Oscuro', icon: 'dark_mode' }
]

export default function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const refreshSettings = useStore((s) => s.refreshSettings)

  const [group, setGroup] = useState<Group>('apariencia')
  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.geni.app.version().then(setVersion)
  }, [])

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
      size="lg"
      bodyClassName="p-0 overflow-hidden"
      footer={
        <>
          <span className="mr-auto text-[11.6px] font-semibold text-ink-400">GenI {version}</span>
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
        <p className="p-5 text-[13.7px] text-ink-400">Cargando...</p>
      ) : (
        <div className="flex min-h-[420px]">
          {/* Sidebar de grupos dentro del modal */}
          <nav className="w-[170px] shrink-0 border-r border-line/40 p-2.5">
            {GROUPS.map((g) => {
              const active = group === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => setGroup(g.id)}
                  className={cn(
                    'mb-1 flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left text-[13.7px] font-bold transition-colors duration-150',
                    active
                      ? 'bg-white/85 text-cobalt-700 shadow-soft dark:bg-white/12'
                      : 'text-ink-500 hover:bg-white/55 hover:text-ink-700 dark:hover:bg-white/8'
                  )}
                >
                  <Icon
                    name={g.icon}
                    filled={active}
                    className={cn('shrink-0 text-[18.9px]', active && 'text-cobalt-600')}
                  />
                  {g.label}
                </button>
              )
            })}
          </nav>

          <div className="scroll min-w-0 flex-1 p-5">
            {group === 'apariencia' && (
              <>
                <GroupTitle>Tema</GroupTitle>
                <div className="grid grid-cols-2 gap-2">
                  {THEMES.map((t) => {
                    const active = current.theme === t.value
                    return (
                      <button
                        key={t.value}
                        onClick={() => {
                          setDraft({ ...current, theme: t.value })
                          // Se aplica al instante para verlo antes de guardar.
                          applyTheme(t.value)
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-box border px-3 py-2.5 text-[13.7px] font-bold transition-colors',
                          active
                            ? 'border-cobalt-500/60 bg-tint/16 text-cobalt-700'
                            : 'border-line/60 bg-white/45 text-ink-500 hover:text-ink-700 dark:bg-white/5'
                        )}
                      >
                        <Icon name={t.icon} filled={active} className="text-[20px]" />
                        {t.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11.6px] leading-snug text-ink-400">
                  El cambio se ve al instante; se guarda al pulsar Guardar.
                </p>
              </>
            )}

            {group === 'comfyui' && (
              <>
                <GroupTitle>Instalacion</GroupTitle>
                <label className="mb-1.5 block text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
                  Carpeta
                </label>
                <div className="mb-4 flex gap-2">
                  <input
                    value={current.comfyPath}
                    onChange={(e) => setDraft({ ...current, comfyPath: e.target.value })}
                    className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/70 px-3 py-2 text-[13.7px] text-ink-800 outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14 dark:bg-white/6"
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
                  className="font-mono text-[12.6px]"
                  value={current.launchArgs}
                  onChange={(e) => setDraft({ ...current, launchArgs: e.target.value })}
                  hint="--disable-pinned-memory hace falta mientras el archivo de paginacion de Windows siga desactivado."
                />

                <GroupTitle>Conexion</GroupTitle>
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
              </>
            )}

            {group === 'apikeys' && (
              <>
                <GroupTitle>Descarga de modelos</GroupTitle>
                <p className="-mt-1 mb-4 text-[12.6px] leading-snug text-ink-500">
                  Solo hacen falta para bajar modelos con licencia restringida. Se guardan en la
                  base local de tu equipo, nunca salen de aca.
                </p>

                <TextField
                  label="Civitai"
                  type="password"
                  placeholder="Sin token"
                  value={current.civitaiToken}
                  onChange={(e) => setDraft({ ...current, civitaiToken: e.target.value })}
                  hint="civitai.com/user/account, seccion API Keys."
                />

                <TextField
                  label="Hugging Face"
                  type="password"
                  placeholder="Sin token"
                  value={current.huggingFaceToken}
                  onChange={(e) => setDraft({ ...current, huggingFaceToken: e.target.value })}
                  hint="huggingface.co/settings/tokens, permiso de solo lectura."
                />

                <p className="mt-4 flex items-start gap-2 rounded-box border border-amber/30 bg-amber-bg/40 p-2.5 text-[11.6px] leading-snug text-amber-text">
                  <Icon name="warning" filled className="mt-px shrink-0 text-[15.8px]" />
                  Estos tokens dan acceso a tu cuenta. Si alguna vez los compartiste en un chat o
                  captura, generá uno nuevo y reemplazalo aca.
                </p>
              </>
            )}

            {group === 'acerca' && (
              <>
                <GroupTitle>Version</GroupTitle>
                <p className="mb-4 text-[13.7px] text-ink-600">
                  GenI <span className="font-bold text-ink-800">{version}</span>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="system_update"
                  onClick={() => void window.geni.updates.check()}
                >
                  Buscar actualizaciones
                </Button>
                <p className="mt-3 text-[11.6px] leading-snug text-ink-400">
                  Las actualizaciones se descargan de GitHub Releases. Tus conversaciones y
                  ajustes viven fuera de la carpeta del programa, asi que actualizar no los toca.
                </p>
              </>
            )}

            {error && (
              <p className="mt-4 flex items-start gap-1.5 text-[12.6px] font-semibold text-rose-text">
                <Icon name="error" filled className="mt-px text-[15.8px]" />
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function GroupTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="mb-3 mt-1 text-[11.6px] font-extrabold uppercase tracking-wider text-ink-500 first:mt-0 [&:not(:first-child)]:mt-6">
      {children}
    </h3>
  )
}
