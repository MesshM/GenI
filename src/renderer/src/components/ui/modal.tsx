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
  /** Sin uso ya (quedo del morph compartido); se deja para no romper a quien lo pasaba. */
  radius?: number
}

export function ModalTrigger({
  children,
  className,
  fullWidth = false
}: ModalTriggerProps): React.JSX.Element {
  const { isOpen, setIsOpen } = useModalCtx()
  return (
    <div
      style={{ width: fullWidth ? '100%' : 'fit-content' }}
      className={cn('cursor-pointer', className)}
      onClick={() => !isOpen && setIsOpen(true)}
      role="button"
      aria-expanded={isOpen}
    >
      {children}
    </div>
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
  const { isOpen, setIsOpen } = useModalCtx()
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
          <motion.div
            className="fixed inset-0 z-69 bg-[oklch(0.25_0.02_20/0.45)] backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.4, 1] }}
            onClick={closeOnBackdrop ? () => setIsOpen(false) : undefined}
          />

          <div className="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-4">
            {/*
              Antes esto compartia layoutId con el disparador (el boton se
              "convertia" en el modal). Se saco: Framer mide el boton
              disparador para armar esa animacion, y si esa medicion pasa
              antes de que la tipografia de iconos (una fuente variable de
              5MB, autohospedada) termine de asentar el layout, la medicion
              queda vieja y la animacion se traba a mitad de camino — el
              panel queda con scale casi en cero y opacity 0, montado y con
              sus handlers funcionando, pero invisible y en el lugar
              equivocado. Un escala+fade centrado no mide nada de otro
              elemento, asi que no tiene con que trabarse.
            */}
            <motion.div
              className={cn(
                'glass-strong pointer-events-auto relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-panel shadow-glass-lg',
                SIZE_CLASS[size],
                className
              )}
              style={{ borderRadius: 20 }}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
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
