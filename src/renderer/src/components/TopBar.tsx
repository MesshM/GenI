import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export default function TopBar(): React.JSX.Element {
  const comfy = useStore((s) => s.comfy)
  const update = useStore((s) => s.update)
  const [showLog, setShowLog] = useState(false)

  const hasLog = comfy.state === 'starting' || comfy.state === 'error'

  const dot =
    comfy.state === 'ready'
      ? 'bg-green'
      : comfy.state === 'starting'
        ? 'bg-amber animate-pulse'
        : comfy.state === 'error'
          ? 'bg-rose'
          : 'bg-ink-300'

  const label =
    comfy.state === 'ready'
      ? `${comfy.device.replace(/^cuda:\d+\s*/, '')} · ${(comfy.vramTotalMb / 1024).toFixed(0)} GB`
      : comfy.state === 'starting'
        ? 'Arrancando ComfyUI'
        : comfy.state === 'error'
          ? 'ComfyUI con problemas'
          : 'ComfyUI detenido'

  return (
    <>
      <header className="drag-region flex h-14 shrink-0 items-center gap-3 px-6">
        <button
          onClick={() => hasLog && setShowLog((v) => !v)}
          className={cn(
            'no-drag flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-[12.6px] font-bold text-ink-700 shadow-soft backdrop-blur transition-colors dark:border-white/10 dark:bg-white/6',
            hasLog && 'hover:bg-white'
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', dot)} />
          {label}
          {hasLog && <Icon name="expand_more" className="text-[16.8px] text-ink-400" />}
        </button>

        {(comfy.state === 'stopped' || comfy.state === 'error') && (
          <Button
            size="sm"
            variant="secondary"
            icon="play_arrow"
            className="no-drag"
            onClick={() => void window.geni.comfy.start()}
          >
            Arrancar
          </Button>
        )}

        <div className="flex-1" />

        {update?.available && (
          <div className="no-drag flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[12.6px] font-bold text-ink-700 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6">
            <Icon name="rocket_launch" className="text-[16.8px] text-cobalt-600" />
            <span>Version {update.version}</span>
            {update.downloaded ? (
              <button
                onClick={() => void window.geni.updates.install()}
                className="rounded-full bg-cta px-2.5 py-0.5 text-white shadow-blue"
              >
                Reiniciar
              </button>
            ) : update.downloading ? (
              <span className="text-ink-500">{update.percent}%</span>
            ) : (
              <button
                onClick={() => void window.geni.updates.download()}
                className="rounded-full bg-cta px-2.5 py-0.5 text-white shadow-blue"
              >
                Descargar
              </button>
            )}
          </div>
        )}
      </header>

      {showLog && hasLog && (
        <div className="mx-6 mb-3 max-h-52 shrink-0 overflow-auto rounded-panel border border-white/70 bg-white/70 p-3 font-mono text-[11.6px] leading-relaxed text-ink-600 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6">
          {comfy.state === 'error' && (
            <p className="mb-2 font-sans text-[12.6px] font-bold text-rose-text">{comfy.message}</p>
          )}
          {comfy.log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </>
  )
}
