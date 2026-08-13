import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import MessageBubble from './MessageBubble'
import { Icon } from './ui/icon'
import { Button } from './ui/button'

export default function ChatPanel(): React.JSX.Element {
  const messages = useStore((s) => s.messages)
  const progress = useStore((s) => s.progress)
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const send = useStore((s) => s.send)
  const comfy = useStore((s) => s.comfy)
  const recipes = useStore((s) => s.recipes)

  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const ready = comfy.state === 'ready' && recipes.length > 0

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (ready && prompt.trim()) void send()
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col px-2 pb-4">
      <div className="scroll flex-1 px-4 pt-2">
        {messages.length === 0 ? (
          <div className="mx-auto mt-24 max-w-md animate-fade-up text-center">
            <span className="grid mx-auto h-14 w-14 place-items-center rounded-panel bg-white/70 shadow-lift dark:bg-white/6">
              <Icon name="auto_awesome" filled className="text-[29.4px] text-cobalt-500" />
            </span>
            <p className="mt-4 text-[17.9px] font-extrabold tracking-tight text-ink-800">
              Escribi un prompt para empezar
            </p>
            <p className="mt-1.5 text-[13.7px] leading-snug text-ink-500">
              Los parametros de la izquierda se aplican a cada generacion. Podes cambiarlos entre
              mensaje y mensaje sin perder la conversacion.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} progress={progress[m.id]} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="mx-auto mt-3 w-full max-w-2xl px-4">
        <div className="glass-strong rounded-panel p-2.5 shadow-lift">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder={
              comfy.state !== 'ready'
                ? 'Esperando a que ComfyUI este listo...'
                : recipes.length === 0
                  ? 'Instala un modelo para poder generar'
                  : 'Describi la imagen... (Enter para enviar, Shift+Enter para salto de linea)'
            }
            disabled={!ready}
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[14.7px] leading-relaxed text-ink-800 outline-none placeholder:text-ink-400 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11.6px] font-semibold text-ink-400">
              {prompt.trim().split(/\s+/).filter(Boolean).length} palabras
            </span>
            <Button
              size="sm"
              icon="auto_awesome"
              disabled={!ready || !prompt.trim()}
              onClick={() => void send()}
            >
              Generar
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
