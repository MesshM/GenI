import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ImageWithSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string
  skeletonClassName?: string
  wrapperStyle?: React.CSSProperties
}

/**
 * Imagen con placeholder gris de barrido mientras carga (mismo `.skeleton`
 * que usa el placeholder de generacion en progreso), para que las miniaturas
 * de conversaciones, presets y resultados no salten en blanco al cargar.
 */
export function ImageWithSkeleton({
  src,
  className,
  wrapperClassName,
  skeletonClassName,
  wrapperStyle,
  onLoad,
  onError,
  ...rest
}: ImageWithSkeletonProps): React.JSX.Element {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const ref = useRef<HTMLImageElement>(null)

  // Si la imagen ya estaba en cache, el evento `load` puede dispararse antes
  // de que React enganche su handler y entonces no llega nunca: la imagen
  // quedaba invisible para siempre detras del esqueleto (se veia al abrir el
  // modal de colecciones con imagenes que el chat ya habia mostrado).
  // `complete` + `naturalWidth` es la forma de preguntarle al navegador si ya
  // termino, sin depender del evento.
  useEffect(() => {
    const img = ref.current
    if (img?.complete && img.naturalWidth > 0) setState('ready')
    else setState('loading')
  }, [src])

  return (
    <div className={cn('relative', wrapperClassName)} style={wrapperStyle}>
      {state === 'loading' && <div className={cn('skeleton absolute inset-0', skeletonClassName)} />}
      <img
        ref={ref}
        src={src}
        className={cn(
          'transition-opacity duration-300',
          state === 'ready' ? 'opacity-100' : 'opacity-0',
          className
        )}
        onLoad={(e) => {
          setState('ready')
          onLoad?.(e)
        }}
        onError={(e) => {
          // Sin esto una ruta que no se puede servir deja el esqueleto
          // latiendo para siempre, como si todavia estuviera cargando.
          setState('error')
          onError?.(e)
        }}
        {...rest}
      />
      {state === 'error' && (
        <div className="absolute inset-0 grid place-items-center rounded-[inherit] bg-fog/20 text-ink-300">
          <span className="material-symbols-rounded select-none text-[20px]">broken_image</span>
        </div>
      )}
    </div>
  )
}
