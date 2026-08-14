import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useStore } from '../store/useStore'
import MessageBubble from './MessageBubble'
import CollectModal from './CollectModal'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { TranslateButton } from './ui/translate-button'
import { useAutoGrow } from '@/lib/useAutoGrow'
import type { Generation, Message } from '@shared/types'

export default function ChatPanel(): React.JSX.Element {
  const messages = useStore((s) => s.messages)
  const progress = useStore((s) => s.progress)
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const send = useStore((s) => s.send)
  const comfy = useStore((s) => s.comfy)
  const recipes = useStore((s) => s.recipes)
  const activeId = useStore((s) => s.activeId)

  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const promptRef = useAutoGrow(prompt)
  const [focused, setFocused] = useState(false)

  // Imagen que se esta por guardar en una coleccion (abre el modal).
  const [collecting, setCollecting] = useState<{
    generation: Generation
    message: Message
  } | null>(null)

  // Al abrir la app o cambiar de conversacion el hilo tiene que aparecer ya
  // abajo, no scrollear a la vista. Va en useLayoutEffect (antes de pintar)
  // y sin `behavior: smooth`, si no se ve el recorrido desde arriba.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeId])

  // Las imagenes entran despues de montar y cambian el alto del hilo: sin
  // esto el ultimo mensaje queda tapado al volver a una conversacion vieja.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220
      if (atBottom) el.scrollTop = el.scrollHeight
    })
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [activeId])

  // Mensaje nuevo dentro de la MISMA conversacion: aca si conviene animar,
  // porque el usuario esta mirando y el movimiento le avisa que llego algo.
  // Si lo que cambio fue la conversacion, no: de eso ya se ocupo el salto
  // instantaneo de arriba, y animar ademas es el rebote que se veia al
  // borrar una conversacion o al abrir la app.
  const lastSeen = useRef<{ id: string | null; count: number }>({ id: null, count: 0 })
  useEffect(() => {
    const prev = lastSeen.current
    const sameConversation = prev.id === activeId
    lastSeen.current = { id: activeId, count: messages.length }
    if (sameConversation && messages.length > prev.count) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, activeId])

  // Cualquier mensaje de la conversacion activa generando: el boton pasa a
  // "Generando" y se bloquea para no acumular envios sobre el mismo lote.
  const generating = useMemo(
    () => messages.some((m) => m.status === 'running' || m.status === 'pending'),
    [messages]
  )

  const ready = comfy.state === 'ready' && recipes.length > 0

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (ready && !generating && prompt.trim()) void send()
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col px-2 pb-4">
      <div ref={scrollRef} className="scroll flex-1 px-4 pt-2">
        {messages.length === 0 ? (
          <div className="mx-auto mt-24 max-w-md animate-fade-up text-center">
            <span className="grid mx-auto h-14 w-14 place-items-center rounded-panel bg-white/70 shadow-lift dark:bg-white/6">
              <Icon name="auto_awesome" filled className="text-[29.4px] text-cobalt-500" />
            </span>
            <p className="mt-4 text-[17.9px] font-extrabold tracking-tight text-ink-800">
              Escribe un prompt para empezar
            </p>
            <p className="mt-1.5 text-[13.7px] leading-snug text-ink-500">
              Los parametros de la izquierda se aplican a cada generacion. Puedes cambiarlos entre
              mensaje y mensaje sin perder la conversacion.
            </p>
          </div>
        ) : (
          // Un poco mas ancho que el compositor: cada mensaje son dos
          // columnas (lo pedido y el resultado), pero sin pasarse — el
          // 5xl anterior quedaba enorme para el contenido real.
          <div className="mx-auto max-w-2xl">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                progress={progress[m.id]}
                onCollect={(generation) => setCollecting({ generation, message: m })}
              />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="mx-auto mt-3 w-full max-w-2xl px-4">
        {/* El foco se marca en el contenedor, no en el textarea: un borde
            saltando justo en el borde del texto se sentia raro. El anillo
            entra y sale animado con el mismo borde que ya usan los demas
            inputs de la app (halo/cobalt), no el azul nativo del navegador. */}
        <motion.div
          animate={{
            boxShadow: focused
              ? '0 0 0 3px color-mix(in oklab, var(--color-halo) 40%, transparent)'
              : '0 0 0 0px transparent'
          }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="glass-strong rounded-panel p-2.5 shadow-lift"
        >
          {/* Autogrow sin tope ni scroll interno: crece con el texto, sin
              limite. Se siente raro tener un scroll adentro de una caja que
              ya crece sola. */}
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={1}
            placeholder={
              comfy.state !== 'ready'
                ? 'Esperando a que ComfyUI este listo...'
                : recipes.length === 0
                  ? 'Instala un modelo para poder generar'
                  : 'Describe la imagen... (Enter para enviar, Shift+Enter para salto de linea)'
            }
            disabled={!ready}
            style={{ outline: 'none' }}
            className="w-full resize-none overflow-hidden bg-transparent px-2 py-1.5 text-[14.7px] leading-relaxed text-ink-800 placeholder:text-ink-400 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-3">
              <span className="text-[11.6px] font-semibold text-ink-400">
                {prompt.trim().split(/\s+/).filter(Boolean).length} palabras
              </span>
              <TranslateButton text={prompt} onTranslated={setPrompt} />
            </div>
            <Button
              size="sm"
              icon="auto_awesome"
              loading={generating}
              disabled={!ready || generating || !prompt.trim()}
              onClick={() => void send()}
            >
              {generating ? 'Generando' : 'Generar'}
            </Button>
          </div>
        </motion.div>
      </div>

      {collecting && (
        <CollectModal
          generation={collecting.generation}
          message={collecting.message}
          onClose={() => setCollecting(null)}
        />
      )}
    </main>
  )
}
