import { useEffect, useState } from 'react'
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
  ...rest
}: ImageWithSkeletonProps): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => setLoaded(false), [src])

  return (
    <div className={cn('relative', wrapperClassName)} style={wrapperStyle}>
      {!loaded && <div className={cn('skeleton absolute inset-0', skeletonClassName)} />}
      <img
        src={src}
        loading="lazy"
        className={cn('transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
        {...rest}
      />
    </div>
  )
}
