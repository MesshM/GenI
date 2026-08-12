import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

export default function Onboarding(): React.JSX.Element {
  const refreshSettings = useStore((s) => s.refreshSettings)
  const bootstrap = useStore((s) => s.bootstrap)

  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Intenta encontrar ComfyUI solo, para ahorrarle el paso al usuario.
  useEffect(() => {
    void window.geni.settings.detectComfy().then((found) => {
      if (found) setPath(found)
    })
  }, [])

  async function browse(): Promise<void> {
    const chosen = await window.geni.settings.pickComfyFolder()
    if (chosen) {
      setPath(chosen)
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
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold">Bienvenido a GenI</h1>
        <p className="mt-2 text-muted">
          Para empezar necesito saber donde esta instalado ComfyUI. Es la carpeta que contiene{' '}
          <code className="rounded bg-surface-2 px-1">main.py</code>.
        </p>

        <label className="mt-6 block text-sm font-medium">Carpeta de ComfyUI</label>
        <div className="mt-2 flex gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:\Users\...\ComfyUI"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          />
          <button
            onClick={() => void browse()}
            className="shrink-0 rounded-lg border border-border px-4 py-2 hover:bg-surface-2"
          >
            Buscar
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          onClick={() => void confirm()}
          disabled={!path || busy}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Configurando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
