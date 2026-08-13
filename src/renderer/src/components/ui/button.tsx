import { forwardRef } from 'react'
import { Icon } from './icon'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Boton cuadrado solo-icono. */
  iconOnly?: boolean
  fullWidth?: boolean
  loading?: boolean
  /** Atajo: nombre del Material Symbol a la izquierda. */
  icon?: string
  iconFilled?: boolean
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-cta shadow-cta hover:-translate-y-0.5 hover:brightness-105 hover:shadow-cta-hover',
  secondary:
    'text-ink-900 bg-white/70 border-white/80 shadow-soft hover:bg-white hover:-translate-y-px hover:shadow-lift dark:bg-white/6 dark:border-white/10 dark:hover:bg-white/12',
  outline:
    'text-ink-700 bg-transparent border-[oklch(0.8_0.03_262/0.7)] hover:border-cobalt-500 hover:text-cobalt-700 hover:bg-white/50 dark:border-white/16 dark:hover:bg-white/8',
  ghost: 'text-ink-700 bg-fog/12 hover:bg-white/85 hover:text-cobalt-600 dark:hover:bg-white/10',
  danger:
    'text-white bg-cta-danger shadow-[0_12px_28px_-14px_oklch(0.64_0.16_18/0.6)] hover:-translate-y-px hover:brightness-[1.06]'
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-[13px] py-2 text-[13.7px] [&_.material-symbols-rounded]:text-[18.9px]',
  md: 'px-[18px] py-[11px] text-[14.7px] [&_.material-symbols-rounded]:text-[21px]',
  lg: 'px-[22px] py-[13px] text-[15.8px] [&_.material-symbols-rounded]:text-[21px]'
}

const ICON_ONLY: Record<ButtonSize, string> = {
  sm: 'gap-0 p-0 w-[34px] h-[34px]',
  md: 'gap-0 p-0 w-[42px] h-[42px]',
  lg: 'gap-0 p-0 w-12 h-12'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    fullWidth = false,
    loading = false,
    icon,
    iconFilled,
    className,
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        // rounded-full: pildora, igual criterio que los botones del sidebar.
        'inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-sans font-bold transition-[transform,box-shadow,filter,background,color,border-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:translate-y-0 disabled:pointer-events-none disabled:cursor-default disabled:opacity-55',
        VARIANT[variant],
        SIZE[size],
        iconOnly && ICON_ONLY[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading && <Icon name="progress_activity" className="animate-spin-fast" />}
      {!loading && icon && <Icon name={icon} filled={iconFilled} />}
      {!iconOnly && children}
      {iconOnly && !icon && !loading && children}
    </button>
  )
})
