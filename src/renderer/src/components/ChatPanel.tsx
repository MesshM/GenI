import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import MessageBubble from './MessageBubble'

export default function ChatPanel(): React.JSX.Element {
  const messages = useStore((s) => s.messages)
  const progress = useStore((s) => s.progress)
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const send = useStore((s) => s.send)
  const comfy = useStore((s) => s.comfy)

  const endRef = useRef<HTMLDivElement>(null)

  // Sigue el final de la conversacion a medida que llegan mensajes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const ready = comfy.state === 'ready'

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter envia; Shift+Enter hace salto de linea.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (ready && prompt.trim()) void send()
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="mx-auto mt-24 max-w-md text-center text-muted">
            <p className="text-lg">Escribi un prompt para empezar</p>
            <p className="mt-2 text-sm">
              Los parametros de la izquierda se aplican a cada generacion. Podes cambiarlos entre
              mensaje y mensaje.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} progress={progress[m.id]} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-surface p-4">
        <div className="mx-auto max-w-3xl">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder={
              ready
                ? 'Describi la imagen... (Enter para enviar, Shift+Enter para salto de linea)'
                : 'Esperando a que ComfyUI este listo...'
            }
            disabled={!ready}
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
          <div className="mt-2 flex items-center justify-end">
            <button
              onClick={() => void send()}
              disabled={!ready || !prompt.trim()}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Generar
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
