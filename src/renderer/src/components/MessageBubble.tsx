import { useState } from 'react'
import { useStore, imageUrl } from '../store/useStore'
import { Icon } from './ui/icon'
import { ImageWithSkeleton } from './ui/image'
import { Tooltip } from './ui/tooltip'
import { cn } from '@/lib/utils'
import type { Generation, GenerationProgress, Message } from '@shared/types'

interface Props {
  message: Message
  progress?: GenerationProgress
  /** Abre el modal para guardar esta imagen en una coleccion. */
  onCollect?: (generation: Generation) => void
}

export default function MessageBubble({ message, progress, onCollect }: Props): React.JSX.Element {
  const loadParamsFrom = useStore((s) => s.loadParamsFrom)
  const cancel = useStore((s) => s.cancel)
  const send = useStore((s) => s.send)
  const patchParams = useStore((s) => s.patchParams)
  const [copied, setCopied] = useState<'prompt' | 'negative' | null>(null)

  const running = message.status === 'running' || message.status === 'pending'
  const pct = progress && progress.max > 0 ? Math.round((progress.value / progress.max) * 100) : 0

  function reroll(): void {
    loadParamsFrom(message)
    patchParams({ randomSeed: true })
    setTimeout(() => void send(), 0)
  }

  function copy(which: 'prompt' | 'negative', text: string): void {
    void navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 1400)
  }

  const activeLoras = message.params.loras.filter((l) => l.enabled)
  const usedTriggers = activeLoras.flatMap((l) =>
    l.triggers.map((word) => ({ modelId: l.modelId, word }))
  )
  const cols = message.params.batchSize > 1 ? 'grid-cols-2' : 'grid-cols-1'

  // Una imagen bien apaisada (ej. 12:5) se ve apretada al lado del texto en
  // una columna angosta: para esas, la imagen pasa arriba a todo el ancho y
  // el resto queda abajo. Cuadradas y verticales, que son la mayoria, se
  // mantienen lado a lado, prompt a la izquierda y resultado a la derecha.
  const ratio = message.params.width / message.params.height
  const wide = ratio >= 1.5

  const requested = (
    <div className="min-w-0">
      <p className="whitespace-pre-wrap text-[13.7px] leading-relaxed text-ink-800">
        {message.prompt}
      </p>

      {message.negative && (
        <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-snug text-ink-400">
          <span className="font-bold uppercase tracking-wider">Negativo · </span>
          {message.negative}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
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
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Icon name="sell" className="text-[11px] text-ink-400" />
          {usedTriggers.map((t) => (
            <span
              key={`${t.modelId}-${t.word}`}
              className="rounded-full border border-line/50 bg-white/50 px-2 py-0.5 text-[10px] font-bold text-ink-500 dark:bg-white/5"
            >
              {t.word}
            </span>
          ))}
        </div>
      )}

      {!running && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          <Action icon="refresh" tip="Otra semilla" onClick={reroll} />
          <Action icon="edit" tip="Editar parametros" onClick={() => loadParamsFrom(message)} />
          <Action
            icon={copied === 'prompt' ? 'check' : 'content_copy'}
            tip="Copiar prompt"
            active={copied === 'prompt'}
            onClick={() => copy('prompt', message.prompt)}
          />
          {message.negative && (
            <Action
              icon={copied === 'negative' ? 'check' : 'content_paste_off'}
              tip="Copiar negativo"
              active={copied === 'negative'}
              onClick={() => copy('negative', message.negative)}
            />
          )}
        </div>
      )}
    </div>
  )

  const result = (
    <div className="min-w-0">
      {running && (
        <>
          <div className="mb-1.5 flex justify-between text-[11px] font-bold text-ink-500">
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
            className="mt-2 text-[11px] font-semibold text-ink-400 underline hover:text-rose"
          >
            Cancelar
          </button>

          {/* Placeholders grises con barrido de brillo, uno por imagen del
              lote, con la proporcion final para que no salten al terminar. */}
          <div className={cn('mt-2.5 grid gap-2', cols)}>
            {Array.from({ length: message.params.batchSize }).map((_, i) => (
              <div
                key={i}
                className="skeleton rounded-box"
                style={{
                  aspectRatio: `${message.params.width} / ${message.params.height}`,
                  maxHeight: wide ? 240 : undefined
                }}
              />
            ))}
          </div>
        </>
      )}

      {message.status === 'error' && (
        <p className="flex items-start gap-2 rounded-box border border-rose/25 bg-rose-bg/60 p-2 text-[11.6px] leading-snug text-rose-text">
          <Icon name="error" filled className="mt-px shrink-0 text-[15px]" />
          {message.error}
        </p>
      )}

      {message.status === 'cancelled' && (
        <p className="text-[11.6px] font-semibold text-ink-400">Cancelado.</p>
      )}

      {message.generations.length > 0 && (
        <div className={cn('grid gap-2', cols)}>
          {message.generations.map((g) => (
            <figure
              key={g.id}
              className="group/img relative mx-auto w-full overflow-hidden rounded-box bg-white/50 shadow-soft dark:bg-white/5"
              // Sin esto una imagen apaisada, aun sola en su columna, podia
              // estirarse mucho de alto; con altura acotada queda a un
              // tamaño legible en vez de dominar la tarjeta entera.
              style={{ maxHeight: wide ? 360 : 700 }}
            >
              <ImageWithSkeleton
                src={imageUrl(g.absPath)}
                alt={message.prompt.slice(0, 80)}
                wrapperClassName="h-full w-full"
                wrapperStyle={{ aspectRatio: `${g.width} / ${g.height}` }}
                className="h-full w-full object-contain"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-ink-900/75 to-transparent p-2 opacity-0 transition-opacity group-hover/img:opacity-100">
                <ImgBtn
                  icon="content_copy"
                  label="Copiar"
                  onClick={() => void window.geni.images.copy(g.absPath)}
                />
                <ImgBtn
                  icon="download"
                  label="Guardar"
                  onClick={() => void window.geni.images.saveAs(g.absPath)}
                />
                <ImgBtn icon="add" label="Coleccion" onClick={() => onCollect?.(g)} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <article
      className={cn(
        'mb-3 grid animate-fade-up gap-3 rounded-panel border border-white/75 bg-white/60 p-3.5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/6',
        wide ? 'grid-cols-1' : 'lg:grid-cols-2'
      )}
    >
      {wide ? (
        <>
          {result}
          {requested}
        </>
      ) : (
        <>
          {requested}
          {result}
        </>
      )}
    </article>
  )
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line/50 bg-white/60 px-2 py-0.5 text-[10.5px] font-bold text-ink-500 dark:bg-white/6">
      <Icon name={icon} className="text-[12.6px]" />
      {children}
    </span>
  )
}

/** Accion solo-icono; el tooltip dice que hace. */
function Action({
  icon,
  tip,
  onClick,
  active
}: {
  icon: string
  tip: string
  onClick: () => void
  active?: boolean
}): React.JSX.Element {
  return (
    <Tooltip text={tip}>
      <button
        onClick={onClick}
        aria-label={tip}
        className={cn(
          'grid h-6.5 w-6.5 place-items-center rounded-chip transition-colors',
          active
            ? 'text-green-deep'
            : 'text-ink-400 hover:bg-tint/16 hover:text-cobalt-600 dark:hover:bg-white/10'
        )}
      >
        <Icon name={icon} className="text-[15px]" />
      </button>
    </Tooltip>
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
    <Tooltip text={label}>
      <button
        onClick={onClick}
        aria-label={label}
        // Negro fijo (no un token que se invierte en oscuro): este boton flota
        // sobre una imagen generada de colores arbitrarios, no sobre el chrome
        // de la app, asi que necesita su propio contraste siempre igual.
        //
        // En reposo es vidrio (blur sobre la imagen); el blanco solido del
        // hover entra y sale como una capa aparte con su propia transicion,
        // porque animar el background-color del boton corta la ilusion de
        // vidrio a mitad de camino.
        className="group/btn relative grid h-6.5 w-6.5 shrink-0 place-items-center overflow-hidden rounded-full bg-black/25 text-white backdrop-blur-md transition-[color,transform] duration-200 hover:scale-105 hover:text-black"
      >
        <span className="absolute inset-0 scale-50 rounded-full bg-white opacity-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover/btn:scale-100 group-hover/btn:opacity-100" />
        <Icon name={icon} className="relative text-[14px]" />
      </button>
    </Tooltip>
  )
}
