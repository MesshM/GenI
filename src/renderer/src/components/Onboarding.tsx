import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'

export default function Onboarding(): React.JSX.Element {
  const refreshSettings = useStore((s) => s.refreshSettings)
  const bootstrap = useStore((s) => s.bootstrap)

  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    void window.geni.settings.detectComfy().then((found) => {
      if (found) {
        setPath(found)
        setDetected(true)
      }
    })
  }, [])

  async function browse(): Promise<void> {
    const chosen = await window.geni.settings.pickComfyFolder()
    if (chosen) {
      setPath(chosen)
      setDetected(false)
      setError(null)
    }
  }

  async function confirm(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await refreshSettings({ comfyPath: path })
      await bootstrap()
      void window.geni.comfy.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full place-items-center bg-bloom p-8">
      <div className="glass w-full max-w-lg animate-pop-in p-8">
        <span className="grid h-14 w-14 place-items-center rounded-panel bg-cta text-white shadow-blue">
          <Icon name="brush" filled className="text-[28px]" />
        </span>

        <h1 className="mt-5 text-[26px] font-extrabold tracking-tight text-ink-900">
          Bienvenido a GenI
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
          Para empezar necesito saber donde esta instalado ComfyUI. Es la carpeta que contiene{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[12px] text-cobalt-700 dark:bg-white/8">
            main.py
          </code>
          .
        </p>

        {detected && (
          <p className="mt-4 flex items-center gap-2 rounded-box border border-green/25 bg-green-bg/50 px-3 py-2 text-[12px] font-semibold text-green-deep">
            <Icon name="check_circle" filled className="text-[16px]" />
            La encontre sola. Revisa que sea la correcta.
          </p>
        )}

        <label className="mt-5 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
          Carpeta de ComfyUI
        </label>
        <div className="flex gap-2">
          <input
            value={path}
            onChange={(e) => {
              setPath(e.target.value)
              setDetected(false)
            }}
            placeholder="C:\Users\...\ComfyUI"
            className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/80 px-3 py-2.5 text-[13px] text-ink-800 outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14 dark:bg-white/6"
          />
          <Button variant="secondary" icon="folder_open" onClick={() => void browse()}>
            Buscar
          </Button>
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] font-semibold text-rose-text">
            <Icon name="error" filled className="mt-px text-[15px]" />
            {error}
          </p>
        )}

        <Button
          fullWidth
          size="lg"
          className="mt-6"
          loading={busy}
          disabled={!path}
          onClick={() => void confirm()}
        >
          {busy ? 'Configurando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
