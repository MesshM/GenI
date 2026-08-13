import { useLayoutEffect, useRef } from 'react'

/**
 * Ajusta la altura de un textarea a su contenido en cada cambio, sin tirador
 * manual. El limite visual (si lo hay) lo pone el className del propio
 * textarea con max-h + overflow; aca solo se calcula la altura natural.
 */
export function useAutoGrow(value: string): React.RefObject<HTMLTextAreaElement | null> {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return ref
}
