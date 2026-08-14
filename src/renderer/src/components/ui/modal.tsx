import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, MotionConfig, motion, type Transition } from 'motion/react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const SPRING: Transition = { type: 'spring', bounce: 0.05, duration: 0.35 }

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[540px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]'
}

interface ModalContextValue {
  isOpen: boolean
  setIsOpen: (v: boolean) => void
  uniqueId: string
}

const ModalCtx = createContext<ModalContextValue | null>(null)

function useModalCtx(): ModalContextValue {
  const ctx = useContext(ModalCtx)
  if (!ctx) throw new Error('<ModalTrigger>/<Modal> deben usarse dentro de <ModalRoot>')
  return ctx
}

interface ModalRootProps {
  children: ReactNode
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  transition?: Transition
}

export function ModalRoot({
  children,
  isOpen: controlled,
  onOpenChange,
  transition
}: ModalRootProps): React.JSX.Element {
  const [uncontrolled, setUncontrolled] = useState(false)
  const uniqueId = useId()

  const isControlled = controlled !== undefined
  const isOpen = isControlled ? controlled : uncontrolled

  const setIsOpen = useCallback(
    (v: boolean) => {
      if (isControlled) onOpenChange?.(v)
      else setUncontrolled(v)
    },
    [isControlled, onOpenChange]
  )

  return (
    <ModalCtx.Provider value={{ isOpen, setIsOpen, uniqueId }}>
      <MotionConfig transition={transition ?? SPRING}>{children}</MotionConfig>
    </ModalCtx.Provider>
  )
}

interface ModalTriggerProps {
  children: ReactNode
  className?: string
  fullWidth?: boolean
  /** Radio del disparador. Framer lo anima hasta el del panel. */
  radius?: number
}

/** Queda visible: el backdrop lo tapa. Framer lee su posicion para animar desde ahi. */
export function ModalTrigger({
  children,
  className,
  fullWidth = false,
  radius = 14
}: ModalTriggerProps): React.JSX.Element {
  const { isOpen, setIsOpen, uniqueId } = useModalCtx()
  return (
    <motion.div
      layoutId={`modal-${uniqueId}`}
      style={{ borderRadius: radius, width: fullWidth ? '100%' : 'fit-content' }}
      className={cn('cursor-pointer', className)}
      onClick={() => !isOpen && setIsOpen(true)}
      role="button"
      aria-expanded={isOpen}
    >
      {children}
    </motion.div>
  )
}

interface ModalProps {
  children: ReactNode
  title?: ReactNode
  footer?: ReactNode
  size?: ModalSize
  className?: string
  bodyClassName?: string
  showClose?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}

export function Modal({
  children,
  title,
  footer,
  size = 'md',
  className,
  bodyClassName,
  showClose = true,
  closeOnBackdrop = true,
  closeOnEscape = true
}: ModalProps): React.JSX.Element | null {
  const { isOpen, setIsOpen, uniqueId } = useModalCtx()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen && closeOnEscape) setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, setIsOpen, closeOnEscape])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence initial={false}>
      {isOpen && (
        <>
          {/* no-drag en el backdrop y en el panel: sin esto, la franja
              arrastrable de la barra de titulo (arbol de React aparte,
              dentro de #root) sigue activa para el sistema operativo en
              esos mismos pixeles de pantalla aunque el modal se pinte
              encima. -webkit-app-region no lo decide el z-index ni el
              orden del DOM: hay que apagarlo a mano donde el modal tape
              esa franja, si no un click ahi (por ej. en la X) se
              interpreta como arrastrar/doble-click de la ventana. */}
          <motion.div
            className="no-drag fixed inset-0 z-69 bg-[oklch(0.25_0.02_20/0.45)] backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.4, 1] }}
            onClick={closeOnBackdrop ? () => setIsOpen(false) : undefined}
          />

          <div className="no-drag pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-4">
            <motion.div
              layoutId={`modal-${uniqueId}`}
              className={cn(
                'glass-strong pointer-events-auto relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-panel shadow-glass-lg will-change-transform',
                SIZE_CLASS[size],
                className
              )}
              style={{ borderRadius: 20 }}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {(title || showClose) && (
                <div className="flex shrink-0 items-center gap-3 border-b border-line/45 py-4 pl-5 pr-4.5">
                  <span className="min-w-0 flex-1 text-[17.9px] font-extrabold tracking-[-0.02em] text-ink-900">
                    {title}
                  </span>
                  {showClose && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon="close"
                      aria-label="Cerrar"
                      onClick={() => setIsOpen(false)}
                    />
                  )}
                </div>
              )}

              {/* El contenido entra con un leve retraso, cuando el panel ya crecio. */}
              <motion.div
                className={cn('scroll min-h-0 flex-1 p-5', bodyClassName)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ delay: 0.08 }}
              >
                {children}
              </motion.div>

              {footer && (
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line/45 px-5 py-3.5">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
