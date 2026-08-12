import { useStore, imageUrl } from '../store/useStore'
import type { GenerationProgress, Message } from '@shared/types'

interface Props {
  message: Message
  progress?: GenerationProgress
}

export default function MessageBubble({ message, progress }: Props): React.JSX.Element {
  const loadParamsFrom = useStore((s) => s.loadParamsFrom)
  const cancel = useStore((s) => s.cancel)
  const send = useStore((s) => s.send)
  const patchParams = useStore((s) => s.patchParams)

  const running = message.status === 'running' || message.status === 'pending'
  const pct = progress && progress.max > 0 ? Math.round((progress.value / progress.max) * 100) : 0

  /** Repite la misma generacion con otra semilla. */
  function reroll(): void {
    loadParamsFrom(message)
    patchParams({ randomSeed: true })
    setTimeout(() => void send(), 0)
  }

  return (
    <article className="mb-6 rounded-xl border border-border bg-surface p-4">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.prompt}</p>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
        <Chip>{message.params.width}×{message.params.height}</Chip>
        <Chip>{message.params.steps} pasos</Chip>
        <Chip>CFG {message.params.cfg}</Chip>
        <Chip>{message.params.samplerName}</Chip>
        <Chip>seed {message.params.seed}</Chip>
      </div>

      {running && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>{progress?.currentNode || 'En cola...'}</span>
            <span>{pct > 0 ? `${pct}%` : ''}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={() => void cancel(message.id)}
            className="mt-2 text-[11px] text-muted underline hover:text-text"
          >
            Cancelar
          </button>
        </div>
      )}

      {message.status === 'error' && (
        <p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
          {message.error}
        </p>
      )}

      {message.status === 'cancelled' && (
        <p className="mt-3 text-xs text-muted">Cancelado.</p>
      )}

      {message.generations.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {message.generations.map((g) => (
            <figure key={g.id} className="group relative overflow-hidden rounded-lg bg-surface-2">
              <img
                src={imageUrl(g.absPath)}
                alt={message.prompt.slice(0, 80)}
                loading="lazy"
                className="w-full object-contain"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/70 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <SmallBtn onClick={() => void window.geni.images.copy(g.absPath)}>Copiar</SmallBtn>
                <SmallBtn onClick={() => void window.geni.images.saveAs(g.absPath)}>
                  Guardar
                </SmallBtn>
                <SmallBtn onClick={() => void window.geni.images.reveal(g.absPath)}>
                  Carpeta
                </SmallBtn>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!running && (
        <div className="mt-3 flex gap-3 text-[11px]">
          <button onClick={reroll} className="text-muted underline hover:text-text">
            Repetir con otra semilla
          </button>
          <button
            onClick={() => loadParamsFrom(message)}
            className="text-muted underline hover:text-text"
          >
            Editar parametros
          </button>
        </div>
      )}
    </article>
  )
}

function Chip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="rounded bg-surface-2 px-1.5 py-0.5">{children}</span>
}

function SmallBtn({
  onClick,
  children
}: {
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
    >
      {children}
    </button>
  )
}
