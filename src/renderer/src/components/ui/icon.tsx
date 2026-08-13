import { cn } from '@/lib/utils'

interface IconProps {
  /** Nombre del simbolo (Material Symbols Rounded). Ej: "auto_awesome". */
  name: string
  className?: string
  /** Relleno solido del icono. */
  filled?: boolean
  style?: React.CSSProperties
  title?: string
}

export function Icon({ name, className, filled = false, style, title }: IconProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      title={title}
      className={cn('material-symbols-rounded select-none', className)}
      style={{
        ...(filled ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : {}),
        ...style
      }}
    >
      {name}
    </span>
  )
}
