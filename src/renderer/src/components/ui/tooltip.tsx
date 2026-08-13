import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './icon'
import { cn } from '@/lib/utils'

/**
 * Signo de interrogacion que muestra una explicacion al pasar el mouse.
 *
 * Se porta a document.body y se posiciona con coordenadas de viewport, igual
 * que el Select: los paneles glass usan backdrop-filter, que crea su propio
 * containing block para position:fixed (lo mismo que hace transform). Sin
 * portal, el tooltip queda atrapado dentro del panel y aparece recortado o
 * detras del sidebar en vez de flotar sobre todo.
 */
export function InfoTip({ text, className }: { text: string; className?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const iconRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (open && iconRef.current) setRect(iconRef.current.getBoundingClientRect())
  }, [open])

  return (
    <span
      ref={iconRef}
      className={cn('relative inline-flex shrink-0 cursor-help', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Icon
        name="help"
        className="text-[13.7px] text-ink-300 transition-colors hover:text-cobalt-500"
      />

      {createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.span
              role="tooltip"
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 4 }}
              transition={{ duration: 0.13, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                bottom: window.innerHeight - rect.top + 8,
                zIndex: 95
              }}
              // Colores fijos, no tokens de tema: ink-900 se invierte en
              // oscuro (pasa a ser casi blanco), lo que antes dejaba fondo
              // blanco + texto blanco. La burbuja es crema con texto negro
              // fijo en los dos temas, no reacciona al tema de la app.
              className="pointer-events-none w-max max-w-52.5 -translate-x-1/2 rounded-box bg-[#faf3e6] px-2.5 py-1.5 text-[11px] font-semibold normal-case leading-snug tracking-normal text-black shadow-deep"
            >
              {text}
              <span className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 bg-[#faf3e6]" />
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  )
}
