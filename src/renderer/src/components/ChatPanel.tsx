import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore'
import MessageBubble from './MessageBubble'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { TranslateButton } from './ui/translate-button'
import { useAutoGrow } from '@/lib/useAutoGrow'

export default function ChatPanel(): React.JSX.Element {
  const messages = useStore((s) => s.messages)
  const progress = useStore((s) => s.progress)
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const send = useStore((s) => s.send)
  const comfy = useStore((s) => s.comfy)
  const recipes = useStore((s) => s.recipes)

  const endRef = useRef<HTMLDivElement>(null)
  const promptRef = useAutoGrow(prompt)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

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
      <div className="scroll flex-1 px-4 pt-2">
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
          {/* Autogrow sin tope ni scroll interno: crece con el texto, sin
              limite. Se siente raro tener un scroll adentro de una caja que
              ya crece sola. */}
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              comfy.state !== 'ready'
                ? 'Esperando a que ComfyUI este listo...'
                : recipes.length === 0
                  ? 'Instala un modelo para poder generar'
                  : 'Describe la imagen... (Enter para enviar, Shift+Enter para salto de linea)'
            }
            disabled={!ready}
            className="w-full resize-none overflow-hidden bg-transparent px-2 py-1.5 text-[14.7px] leading-relaxed text-ink-800 outline-none placeholder:text-ink-400 disabled:opacity-50"
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
        </div>
      </div>
    </main>
  )
}
