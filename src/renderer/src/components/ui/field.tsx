import { Icon } from './icon'
import { cn } from '@/lib/utils'

// Controles de formulario con el acabado de docline: bordes suaves,
// foco con halo azul y sombra interior sutil.

const CONTROL =
  'w-full rounded-chip border border-line/70 bg-white/70 px-3 py-2 text-[13px] text-ink-800 shadow-[inset_0_1px_2px_rgba(38,54,110,0.04)] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-ink-400 focus:border-halo/50 focus:bg-white focus:ring-4 focus:ring-halo/14 disabled:opacity-50'

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: string
  error?: string
  hint?: string
  wrapClassName?: string
}

export function TextField({
  label,
  icon,
  error,
  hint,
  wrapClassName,
  className,
  ...rest
}: TextFieldProps): React.JSX.Element {
  return (
    <div className={cn('mb-4', wrapClassName)}>
      {label && (
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-ink-400"
          />
        )}
        <input className={cn(CONTROL, icon && 'pl-9', className)} {...rest} />
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-rose-text">{error}</p>}
      {hint && !error && <p className="mt-1 text-[11px] leading-snug text-ink-400">{hint}</p>}
    </div>
  )
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  wrapClassName?: string
}

export function TextArea({
  label,
  hint,
  wrapClassName,
  className,
  ...rest
}: TextAreaProps): React.JSX.Element {
  return (
    <div className={cn('mb-4', wrapClassName)}>
      {label && (
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
          {label}
        </label>
      )}
      <textarea className={cn(CONTROL, 'resize-none leading-relaxed', className)} {...rest} />
      {hint && <p className="mt-1 text-[11px] leading-snug text-ink-400">{hint}</p>}
    </div>
  )
}

interface SelectProps<T extends string> {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
  hint?: string
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint
}: SelectProps<T>): React.JSX.Element {
  return (
    <div className="mb-4">
      {label && (
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          className={cn(CONTROL, 'cursor-pointer appearance-none pr-9 font-semibold')}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-ink-400"
        />
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-ink-400">{hint}</p>}
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  hint?: string
  /** Compacto: usado dentro de las tarjetas de LoRA. */
  dense?: boolean
}

/** Deslizador con el valor editable a mano, como en Civitai. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  dense
}: SliderProps): React.JSX.Element {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n))

  return (
    <div className={dense ? 'mb-2' : 'mb-4'}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
          {label}
        </label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="w-[70px] rounded-[8px] border border-line/70 bg-white/80 px-1.5 py-0.5 text-right text-[12px] font-bold text-ink-800 outline-none focus:border-halo/50 focus:ring-2 focus:ring-halo/14"
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-ink-400">{hint}</p>}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-ink-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-cta shadow-blue' : 'bg-fog/50'
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-soft transition-transform duration-200',
            checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
          )}
        />
      </button>
    </label>
  )
}

export function Section({
  title,
  action,
  children
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
