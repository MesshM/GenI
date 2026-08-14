import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './icon'
import { InfoTip } from './tooltip'
import { cn } from '@/lib/utils'

export interface SelectOption<T extends string> {
  value: T
  label: string
  /** Material Symbol opcional, a la izquierda de la etiqueta. */
  icon?: string
  hint?: string
}

interface SelectProps<T extends string> {
  label?: string
  value: T
  options: SelectOption<T>[]
  onChange: (v: T) => void
  disabled?: boolean
  hint?: string
  tip?: string
  placeholder?: string
}

/**
 * Select propio: el nativo no deja estilar la lista desplegable.
 *
 * Cerrado es una pastilla con un chevron que apunta a la derecha; al abrir el
 * chevron rota hacia abajo y la lista aparece justo debajo. La opcion activa
 * queda marcada con un fondo propio.
 *
 * La lista se posiciona con coordenadas de viewport (position: fixed) para que
 * no la recorte el `overflow` de los paneles con scroll donde vive.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
  tip,
  placeholder = 'Elegir...'
}: SelectProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  // Se mide antes de pintar para que la lista no aparezca desplazada.
  useLayoutEffect(() => {
    if (open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Al hacer scroll el panel de atras, la posicion medida deja de valer y
    // la lista quedaria flotando en el lugar equivocado: se cierra. Pero si
    // el scroll pasa DENTRO de la lista (tiene su propio scroll cuando hay
    // muchas opciones) no hay nada que recalcular, y cerrarla ahi hacia
    // imposible llegar a las ultimas opciones.
    const onScroll = (e: Event): void => {
      const target = e.target
      // El listener de resize tambien entra aca y su target es window, que
      // no es un Node: el instanceof lo descarta y la lista se cierra, que
      // es lo correcto para un cambio de tamaño.
      if (target instanceof Node && listRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  // Si no entra abajo, se despliega hacia arriba.
  const listMaxHeight = 260
  const openUp = rect ? window.innerHeight - rect.bottom < listMaxHeight + 16 : false

  return (
    <div className="mb-4">
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
          {label}
          {tip && <InfoTip text={tip} />}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-chip border px-2.5 py-2 text-left text-[13.7px] font-bold transition-[background,border-color,box-shadow] duration-200 disabled:opacity-50',
          open
            ? // cobalt-500 ya esta redefinido a crema en el tema oscuro (es el
              // mismo token que usa "lo activo" en toda la app); usarlo en vez
              // de halo asegura que el foco sea crema y no un azul suelto.
              'border-cobalt-500/50 bg-white text-ink-900 ring-4 ring-cobalt-500/14 dark:bg-white/10 dark:border-cobalt-500/40 dark:ring-cobalt-500/16'
            : 'border-line/70 bg-white/70 text-ink-800 hover:border-line hover:bg-white hover:shadow-soft dark:bg-white/6 dark:hover:bg-white/10'
        )}
      >
        <Icon
          name="arrow_right"
          className={cn(
            'shrink-0 text-[18.9px] text-ink-400 transition-transform duration-200',
            open && 'rotate-90'
          )}
        />
        {selected?.icon && (
          <Icon name={selected.icon} className="shrink-0 text-[17.9px] text-cobalt-500" />
        )}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-ink-400')}>
          {selected?.label ?? placeholder}
        </span>
      </button>

      {hint && <p className="mt-1 text-[11.6px] leading-snug text-ink-400">{hint}</p>}

      {createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div
              ref={listRef}
              role="listbox"
              initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                top: openUp ? undefined : rect.bottom + 6,
                bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
                maxHeight: listMaxHeight,
                zIndex: 95
              }}
              // no-drag: si el select vive cerca del techo de la ventana
              // (ej. adentro de un modal), la lista puede terminar debajo
              // de la franja arrastrable de la barra de titulo.
              className="no-drag glass-strong scroll overflow-y-auto rounded-box p-1.5 shadow-glass-lg"
            >
              {options.map((o) => {
                const active = o.value === value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left text-[13.7px] font-bold transition-colors duration-150',
                      active
                        ? 'bg-white/85 text-cobalt-700 shadow-soft dark:bg-white/12'
                        : 'text-ink-600 hover:bg-white/60 hover:text-ink-800 dark:hover:bg-white/8'
                    )}
                  >
                    {o.icon && (
                      <Icon
                        name={o.icon}
                        filled={active}
                        className={cn(
                          'shrink-0 text-[18.9px]',
                          active ? 'text-cobalt-600' : 'text-ink-400'
                        )}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && (
                      <span className="shrink-0 text-[10.5px] font-semibold text-ink-400">
                        {o.hint}
                      </span>
                    )}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
