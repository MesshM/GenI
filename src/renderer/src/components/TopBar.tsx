import { useState } from 'react'
import { useStore } from '../store/useStore'
import SettingsDialog from './SettingsDialog'

export default function TopBar(): React.JSX.Element {
  const comfy = useStore((s) => s.comfy)
  const update = useStore((s) => s.update)
  const [showSettings, setShowSettings] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const dot =
    comfy.state === 'ready'
      ? 'bg-ok'
      : comfy.state === 'starting'
        ? 'bg-yellow-400 animate-pulse'
        : comfy.state === 'error'
          ? 'bg-danger'
          : 'bg-muted'

  const label =
    comfy.state === 'ready'
      ? `${comfy.device} · ${(comfy.vramTotalMb / 1024).toFixed(0)} GB`
      : comfy.state === 'starting'
        ? 'Arrancando ComfyUI...'
        : comfy.state === 'error'
          ? 'ComfyUI con problemas'
          : 'ComfyUI detenido'

  const hasLog = comfy.state === 'starting' || comfy.state === 'error'

  return (
    <>
      <header className="drag-region flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <span className="font-semibold tracking-tight">GenI</span>

        <button
          onClick={() => hasLog && setShowLog((v) => !v)}
          className={`no-drag flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs ${
            hasLog ? 'hover:bg-surface-2' : 'cursor-default'
          }`}
          title={comfy.state === 'error' ? comfy.message : undefined}
        >
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
        </button>

        {comfy.state !== 'ready' && comfy.state !== 'starting' && (
          <button
            onClick={() => void window.geni.comfy.start()}
            className="no-drag rounded-lg border border-border px-3 py-1 text-xs hover:bg-surface-2"
          >
            Arrancar ComfyUI
          </button>
        )}

        <div className="flex-1" />

        {update?.available && (
          <div className="no-drag flex items-center gap-2 rounded-lg border border-accent-soft bg-accent-soft px-3 py-1 text-xs">
            <span>Version {update.version} disponible</span>
            {update.downloaded ? (
              <button
                onClick={() => void window.geni.updates.install()}
                className="rounded bg-accent px-2 py-0.5 text-white"
              >
                Reiniciar e instalar
              </button>
            ) : update.downloading ? (
              <span className="text-muted">{update.percent}%</span>
            ) : (
              <button
                onClick={() => void window.geni.updates.download()}
                className="rounded bg-accent px-2 py-0.5 text-white"
              >
                Descargar
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => setShowSettings(true)}
          className="no-drag rounded-lg border border-border px-3 py-1 text-xs hover:bg-surface-2"
        >
          Ajustes
        </button>
      </header>

      {/* El log solo aparece cuando hace falta: arrancando o tras un error. */}
      {showLog && hasLog && (
        <div className="max-h-56 shrink-0 overflow-auto border-b border-border bg-black/40 px-4 py-2 font-mono text-[11px] leading-relaxed text-muted">
          {comfy.state === 'error' && <p className="mb-1 text-danger">{comfy.message}</p>}
          {comfy.log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  )
}
