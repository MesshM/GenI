import { useStore, imageUrl } from '../store/useStore'
import { Icon } from './ui/icon'
import { ImageWithSkeleton } from './ui/image'
import { cn } from '@/lib/utils'
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

  function reroll(): void {
    loadParamsFrom(message)
    patchParams({ randomSeed: true })
    setTimeout(() => void send(), 0)
  }

  const activeLoras = message.params.loras.filter((l) => l.enabled)
  const usedTriggers = activeLoras.flatMap((l) => l.triggers.map((word) => ({ modelId: l.modelId, word })))
  const cols = message.params.batchSize > 1 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <article className="mb-4 animate-fade-up rounded-panel border border-white/75 bg-white/60 p-4 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6">
      <p className="whitespace-pre-wrap text-[14.7px] leading-relaxed text-ink-800">
        {message.prompt}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Chip icon="aspect_ratio">
          {message.params.width}×{message.params.height}
        </Chip>
        <Chip icon="stairs">{message.params.steps} pasos</Chip>
        <Chip icon="tune">CFG {message.params.cfg}</Chip>
        <Chip icon="casino">{message.params.seed}</Chip>
        {activeLoras.map((l) => (
          <Chip key={l.modelId} icon="layers">
            {l.label} {l.strength}
          </Chip>
        ))}
      </div>

      {/* Que trigger words se usaron de verdad en esta generacion — se
          define al momento de generar, no antes, asi queda un registro
          exacto de que se le mando al modelo en cada mensaje. */}
      {usedTriggers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Icon name="sell" className="text-[12.6px] text-ink-400" />
          {usedTriggers.map((t) => (
            <span
              key={`${t.modelId}-${t.word}`}
              className="rounded-full border border-line/50 bg-white/50 px-2 py-0.5 text-[10.5px] font-bold text-ink-500 dark:bg-white/5"
            >
              {t.word}
            </span>
          ))}
        </div>
      )}

      {running && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[11.6px] font-bold text-ink-500">
            <span>{progress?.currentNode || 'En cola...'}</span>
            <span>{pct > 0 ? `${pct}%` : ''}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fog/35">
            <div
              className={cn(
                'h-full bg-cta transition-all duration-200',
                pct === 0 && 'w-1/4 animate-pulse'
              )}
              style={pct > 0 ? { width: `${pct}%` } : undefined}
            />
          </div>
          <button
            onClick={() => void cancel(message.id)}
            className="mt-2 text-[11.6px] font-semibold text-ink-400 underline hover:text-rose"
          >
            Cancelar
          </button>

          {/* Placeholders grises con barrido de brillo, uno por imagen del
              lote, con la proporcion final para que no salten al terminar. */}
          <div className={cn('mt-3 grid gap-2.5', cols)}>
            {Array.from({ length: message.params.batchSize }).map((_, i) => (
              <div
                key={i}
                className="skeleton rounded-box"
                style={{ aspectRatio: `${message.params.width} / ${message.params.height}` }}
              />
            ))}
          </div>
        </div>
      )}

      {message.status === 'error' && (
        <p className="mt-3 flex items-start gap-2 rounded-box border border-rose/25 bg-rose-bg/60 p-2.5 text-[12.6px] leading-snug text-rose-text">
          <Icon name="error" filled className="mt-px shrink-0 text-[16.8px]" />
          {message.error}
        </p>
      )}

      {message.status === 'cancelled' && (
        <p className="mt-3 text-[12.6px] font-semibold text-ink-400">Cancelado.</p>
      )}

      {message.generations.length > 0 && (
        <div className={cn('mt-4 grid gap-2.5', cols)}>
          {message.generations.map((g) => (
            <figure
              key={g.id}
              className="group/img relative overflow-hidden rounded-box bg-white/50 shadow-soft dark:bg-white/5"
            >
              <ImageWithSkeleton
                src={imageUrl(g.absPath)}
                alt={message.prompt.slice(0, 80)}
                wrapperClassName="w-full"
                wrapperStyle={{ aspectRatio: `${g.width} / ${g.height}` }}
                className="h-full w-full object-contain"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-ink-900/75 to-transparent p-2 opacity-0 transition-opacity group-hover/img:opacity-100">
                <ImgBtn icon="content_copy" label="Copiar" onClick={() => void window.geni.images.copy(g.absPath)} />
                <ImgBtn icon="download" label="Guardar" onClick={() => void window.geni.images.saveAs(g.absPath)} />
                <ImgBtn icon="folder_open" label="Carpeta" onClick={() => void window.geni.images.reveal(g.absPath)} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!running && (
        <div className="mt-3 flex gap-3">
          <Action icon="refresh" onClick={reroll}>
            Otra semilla
          </Action>
          <Action icon="edit" onClick={() => loadParamsFrom(message)}>
            Editar parametros
          </Action>
        </div>
      )}
    </article>
  )
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line/50 bg-white/60 px-2 py-0.5 text-[11.6px] font-bold text-ink-500 dark:bg-white/6">
      <Icon name={icon} className="text-[13.7px]" />
      {children}
    </span>
  )
}

function Action({
  icon,
  onClick,
  children
}: {
  icon: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11.6px] font-bold text-ink-500 transition-colors hover:text-cobalt-600"
    >
      <Icon name={icon} className="text-[14.7px]" />
      {children}
    </button>
  )
}

function ImgBtn({
  icon,
  label,
  onClick
}: {
  icon: string
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      // Negro fijo (no un token que se invierte en oscuro): este boton flota
      // sobre una imagen generada de colores arbitrarios, no sobre el chrome
      // de la app, asi que necesita su propio contraste siempre igual.
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/85 text-black backdrop-blur transition-colors hover:bg-white"
    >
      <Icon name={icon} className="text-[15.8px]" />
    </button>
  )
}
