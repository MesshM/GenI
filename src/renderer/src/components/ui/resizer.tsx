import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

interface ResizerProps {
  width: number
  onResize: (w: number) => void
  min: number
  max: number
  /** 'right': el panel esta a la izquierda del tirador (crece hacia la derecha). */
  side: 'right' | 'left'
}

/**
 * Tirador para redimensionar un panel lateral.
 *
 * Escucha en window y no en el propio elemento: si el puntero se mueve rapido
 * y se sale del tirador, el arrastre tiene que seguir funcionando igual.
 */
export function Resizer({ width, onResize, min, max, side }: ResizerProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setDragging(true)

      const startX = e.clientX
      const startW = width

      const move = (ev: PointerEvent): void => {
        const delta = side === 'right' ? ev.clientX - startX : startX - ev.clientX
        onResize(Math.min(max, Math.max(min, startW + delta)))
      }
      const up = (): void => {
        setDragging(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      // Mientras se arrastra, el cursor no debe cambiar al pasar por encima de
      // texto ni debe seleccionarse nada.
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [width, min, max, side, onResize]
  )

  return (
    <div
      onPointerDown={onPointerDown}
      className={cn(
        "grid w-3 shrink-0 touch-none cursor-col-resize place-items-center before:h-[46px] before:w-1 before:rounded-full before:bg-steel/40 before:transition-[background,height] before:duration-200 before:content-['']",
        dragging ? 'before:h-16 before:bg-cobalt-500' : 'hover:before:h-16 hover:before:bg-cobalt-500'
      )}
    />
  )
}
