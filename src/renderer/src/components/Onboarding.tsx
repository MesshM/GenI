import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import type { ComfyInstallProgress, GpuVendor } from '@shared/types'
import isotipo from '@/assets/icons/isotipo.png'

type Step = 'ask' | 'locate' | 'install' | 'installing'

const GPU_LABEL: Record<GpuVendor, string> = {
  amd: 'AMD Radeon',
  nvidia: 'NVIDIA',
  unknown: 'sin placa dedicada reconocida'
}

export default function Onboarding(): React.JSX.Element {
  const [step, setStep] = useState<Step>('ask')

  return (
    <div className="grid h-full place-items-center bg-bloom p-8">
      <div className="glass w-full max-w-lg p-8">
        <img src={isotipo} alt="" className="h-14 w-14 object-contain" />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            {step === 'ask' && <AskStep onPick={setStep} />}
            {step === 'locate' && <LocateStep onBack={() => setStep('ask')} />}
            {(step === 'install' || step === 'installing') && (
              <InstallStep
                installing={step === 'installing'}
                onStart={() => setStep('installing')}
                onBack={() => setStep('ask')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AskStep({ onPick }: { onPick: (s: Step) => void }): React.JSX.Element {
  return (
    <>
      <h1 className="mt-5 text-[27.3px] font-extrabold tracking-tight text-ink-900">
        Bienvenido a GenI
      </h1>
      <p className="mt-2 text-[14.7px] leading-relaxed text-ink-600">
        GenI genera las imagenes con ComfyUI, que corre en tu maquina. ¿Ya lo tienes instalado?
      </p>

      <div className="mt-6 grid gap-2.5">
        <Choice
          icon="folder_open"
          title="Si, ya lo tengo"
          description="Solo indicame la carpeta donde esta."
          onClick={() => onPick('locate')}
        />
        <Choice
          icon="download"
          title="No, instalalo por mi"
          description="GenI lo descarga y arma el entorno de Python. Tarda un rato y ocupa varios GB."
          onClick={() => onPick('install')}
        />
      </div>
    </>
  )
}

function Choice({
  icon,
  title,
  description,
  onClick
}: {
  icon: string
  title: string
  description: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 rounded-box border border-line/70 bg-white/60 p-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-cobalt-500/50 hover:bg-white hover:shadow-soft dark:bg-white/5 dark:hover:bg-white/10"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-tint/16 text-cobalt-600">
        <Icon name={icon} className="text-[20px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-ink-800">{title}</span>
        <span className="block text-[12.6px] leading-snug text-ink-500">{description}</span>
      </span>
    </button>
  )
}

function LocateStep({ onBack }: { onBack: () => void }): React.JSX.Element {
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
    <>
      <h1 className="mt-5 text-[27.3px] font-extrabold tracking-tight text-ink-900">
        ¿Donde esta ComfyUI?
      </h1>
      <p className="mt-2 text-[14.7px] leading-relaxed text-ink-600">
        Es la carpeta que contiene{' '}
        <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[12.6px] text-cobalt-700 dark:bg-white/8">
          main.py
        </code>
        . Queda guardada en Ajustes y puedes cambiarla cuando quieras.
      </p>

      {detected && (
        <p className="mt-4 flex items-center gap-2 rounded-box border border-green/25 bg-green-bg/50 px-3 py-2 text-[12.6px] font-semibold text-green-deep">
          <Icon name="check_circle" filled className="text-[16.8px]" />
          La encontre sola. Revisa que sea la correcta.
        </p>
      )}

      <label className="mb-1.5 mt-5 block text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
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
          className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/80 px-3 py-2.5 text-[13.7px] text-ink-800 outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14 dark:bg-white/6"
        />
        <Button variant="secondary" icon="folder_open" onClick={() => void browse()}>
          Buscar
        </Button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.6px] font-semibold text-rose-text">
          <Icon name="error" filled className="mt-px text-[15.8px]" />
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Atras
        </Button>
        <Button fullWidth loading={busy} disabled={!path} onClick={() => void confirm()}>
          {busy ? 'Configurando...' : 'Continuar'}
        </Button>
      </div>
    </>
  )
}

function InstallStep({
  installing,
  onStart,
  onBack
}: {
  installing: boolean
  onStart: () => void
  onBack: () => void
}): React.JSX.Element {
  const refreshSettings = useStore((s) => s.refreshSettings)
  const bootstrap = useStore((s) => s.bootstrap)

  const [env, setEnv] = useState<{ gpu: GpuVendor; python: string | null; suggestedDir: string }>()
  const [dir, setDir] = useState('')
  const [progress, setProgress] = useState<ComfyInstallProgress | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.geni.install.detectEnv().then((e) => {
      setEnv(e)
      setDir(e.suggestedDir)
    })
  }, [])

  useEffect(() => {
    return window.geni.install.onProgress((p) => {
      if (p.step) setProgress(p)
      if (p.error) setError(p.error)
      if (p.log) {
        setLog((prev) => [...prev.slice(-120), p.log])
        requestAnimationFrame(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
        })
      }
    })
  }, [])

  async function browse(): Promise<void> {
    const chosen = await window.geni.settings.pickInstallFolder()
    if (chosen) setDir(chosen)
  }

  async function start(): Promise<void> {
    onStart()
    setError(null)
    try {
      const installed = await window.geni.install.comfy(dir)
      await refreshSettings({ comfyPath: installed })
      await bootstrap()
      void window.geni.comfy.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (installing) {
    const pct = progress?.percent ?? -1
    return (
      <>
        <h1 className="mt-5 text-[27.3px] font-extrabold tracking-tight text-ink-900">
          Instalando ComfyUI
        </h1>
        <p className="mt-2 text-[14.7px] leading-relaxed text-ink-600">
          {progress?.step ?? 'Preparando...'}
        </p>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-fog/35">
          <div
            className={cn('h-full bg-cta transition-all duration-300', pct < 0 && 'w-1/4 animate-pulse')}
            style={pct >= 0 ? { width: `${pct}%` } : undefined}
          />
        </div>

        <div
          ref={logRef}
          className="scroll mt-4 max-h-40 overflow-auto rounded-box border border-line/60 bg-white/60 p-2.5 font-mono text-[10.5px] leading-relaxed text-ink-500 dark:bg-white/5"
        >
          {log.length === 0 ? <p>Esperando...</p> : log.map((line, i) => <div key={i}>{line}</div>)}
        </div>

        {error ? (
          <>
            <p className="mt-3 flex items-start gap-1.5 text-[12.6px] font-semibold text-rose-text">
              <Icon name="error" filled className="mt-px text-[15.8px]" />
              {error}
            </p>
            <Button variant="outline" className="mt-4" onClick={onBack}>
              Volver
            </Button>
          </>
        ) : (
          <p className="mt-3 text-[11.6px] leading-snug text-ink-400">
            Puede tardar bastante: se descargan varios GB entre PyTorch y las dependencias. No
            cierres la app.
          </p>
        )}
      </>
    )
  }

  return (
    <>
      <h1 className="mt-5 text-[27.3px] font-extrabold tracking-tight text-ink-900">
        Instalar ComfyUI
      </h1>
      <p className="mt-2 text-[14.7px] leading-relaxed text-ink-600">
        Se descarga ComfyUI y se arma un entorno de Python propio, sin tocar el del sistema.
      </p>

      {env && (
        <div className="mt-5 grid gap-1.5 rounded-box border border-line/60 bg-white/50 p-3 text-[12.6px] dark:bg-white/5">
          <Row label="Placa detectada" value={GPU_LABEL[env.gpu]} />
          <Row
            label="Python"
            value={env.python ? `encontrado (${env.python})` : 'no encontrado'}
            bad={!env.python}
          />
          <Row
            label="PyTorch"
            value={
              env.gpu === 'amd'
                ? 'version ROCm'
                : env.gpu === 'nvidia'
                  ? 'version CUDA'
                  : 'version CPU (mas lento)'
            }
          />
        </div>
      )}

      {env && !env.python && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.6px] font-semibold text-rose-text">
          <Icon name="error" filled className="mt-px text-[15.8px]" />
          Hace falta Python 3.10 o mas nuevo. Instalalo desde python.org y volve a abrir GenI.
        </p>
      )}

      <label className="mb-1.5 mt-5 block text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
        Carpeta donde instalar
      </label>
      <div className="flex gap-2">
        <input
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/80 px-3 py-2.5 text-[13.7px] text-ink-800 outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14 dark:bg-white/6"
        />
        <Button variant="secondary" icon="folder_open" onClick={() => void browse()}>
          Elegir
        </Button>
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Atras
        </Button>
        <Button fullWidth disabled={!dir || !env?.python} onClick={() => void start()}>
          Instalar
        </Button>
      </div>
    </>
  )
}

function Row({
  label,
  value,
  bad
}: {
  label: string
  value: string
  bad?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className={cn('font-bold', bad ? 'text-rose-text' : 'text-ink-800')}>{value}</span>
    </div>
  )
}
