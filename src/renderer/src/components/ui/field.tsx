import { Icon } from './icon'
import { InfoTip } from './tooltip'
import { cn } from '@/lib/utils'
import { useAutoGrow } from '@/lib/useAutoGrow'

// Controles de formulario con el acabado de docline: bordes suaves,
// foco con halo azul y sombra interior sutil.

// bg-white/* es literal (no un token que docline re-tina en oscuro): sin el
// dark: de al lado quedaria un recuadro gris claro con texto casi blanco
// encima, poco legible. En oscuro va translucido sobre negro, no blanco.
const CONTROL =
  'w-full rounded-chip border border-line/70 bg-white/70 px-3 py-2 text-[13.7px] text-ink-800 shadow-[inset_0_1px_2px_rgba(38,54,110,0.04)] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-ink-400 focus:border-halo/50 focus:bg-white focus:ring-4 focus:ring-halo/14 disabled:opacity-50 dark:bg-white/6 dark:focus:bg-white/10'

function Label({
  children,
  tip
}: {
  children: React.ReactNode
  tip?: string
}): React.JSX.Element {
  return (
    <span className="mb-1.5 flex items-center gap-1 text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
      {children}
      {tip && <InfoTip text={tip} />}
    </span>
  )
}

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: string
  error?: string
  hint?: string
  tip?: string
  wrapClassName?: string
}

export function TextField({
  label,
  icon,
  error,
  hint,
  tip,
  wrapClassName,
  className,
  ...rest
}: TextFieldProps): React.JSX.Element {
  return (
    <div className={cn('mb-4', wrapClassName)}>
      {label && <Label tip={tip}>{label}</Label>}
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18.9px] text-ink-400"
          />
        )}
        <input className={cn(CONTROL, icon && 'pl-9', className)} {...rest} />
      </div>
      {error && <p className="mt-1 text-[11.6px] font-semibold text-rose-text">{error}</p>}
      {hint && !error && <p className="mt-1 text-[11.6px] leading-snug text-ink-400">{hint}</p>}
    </div>
  )
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  tip?: string
  wrapClassName?: string
}

export function TextArea({
  label,
  hint,
  tip,
  wrapClassName,
  className,
  value,
  ...rest
}: TextAreaProps): React.JSX.Element {
  // Autogrow en vez de tirador manual: crece con lo que se escribe.
  const autoRef = useAutoGrow(typeof value === 'string' ? value : '')

  return (
    <div className={cn('mb-4', wrapClassName)}>
      {label && <Label tip={tip}>{label}</Label>}
      <textarea
        ref={autoRef}
        value={value}
        rows={1}
        className={cn(
          CONTROL,
          'scroll max-h-[280px] min-h-[76px] resize-none overflow-y-auto leading-relaxed',
          className
        )}
        {...rest}
      />
      {hint && <p className="mt-1 text-[11.6px] leading-snug text-ink-400">{hint}</p>}
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
  tip?: string
  /** Compacto: usado dentro de las tarjetas de LoRA. */
  dense?: boolean
  /** Ancho del contador numerico. Por defecto 70px; la semilla usa mas. */
  counterWidth?: number
}

/** Redondea al step evitando el arrastre de coma flotante (0.1+0.2 etc). */
function roundToStep(n: number, step: number): number {
  const precision = (step.toString().split('.')[1] ?? '').length
  return Number(n.toFixed(precision))
}

/** Deslizador con el valor editable a mano y flechas propias, como en Civitai. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  tip,
  dense,
  counterWidth = 70
}: SliderProps): React.JSX.Element {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n))
  const bump = (delta: number): void => onChange(clamp(roundToStep(value + delta, step)))

  return (
    <div className={dense ? 'mb-2' : 'mb-4'}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label tip={tip}>{label}</Label>
        <div className="relative shrink-0" style={{ width: counterWidth }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            // pr-[24px] deja hueco fijo para la columna de flechas: antes el
            // valor quedaba pegado porque el padding no alcanzaba a cubrirla.
            className="w-full rounded-[8px] border border-line/70 bg-white/80 py-[5px] pl-2 pr-[24px] text-right text-[12.6px] font-bold text-ink-800 outline-none focus:border-halo/50 focus:ring-2 focus:ring-halo/14 dark:bg-white/6"
          />
          {/* Flechas propias: las del navegador no se pueden estilar. Ocupan
              todo el alto (antes quedaban de 3px de margen = ~6px total, muy
              poco para mostrar las dos, la de bajar se recortaba). */}
          <div className="absolute inset-y-0 right-0 flex w-[21px] flex-col overflow-hidden rounded-r-[7px] border-l border-line/50">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Aumentar"
              onClick={() => bump(step)}
              className="flex flex-1 items-center justify-center bg-black/[0.03] text-ink-400 transition-colors hover:bg-tint/20 hover:text-cobalt-600 dark:bg-white/6 dark:hover:bg-white/16"
            >
              <Icon name="arrow_drop_up" className="text-[14px]" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Disminuir"
              onClick={() => bump(-step)}
              className="flex flex-1 items-center justify-center border-t border-line/40 bg-black/[0.03] text-ink-400 transition-colors hover:bg-tint/20 hover:text-cobalt-600 dark:bg-white/6 dark:hover:bg-white/16"
            >
              <Icon name="arrow_drop_down" className="text-[14px]" />
            </button>
          </div>
        </div>
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
      {hint && <p className="mt-1 text-[11.6px] leading-snug text-ink-400">{hint}</p>}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  tip
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  tip?: string
}): React.JSX.Element {
  return (
    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3">
      <span className="flex items-center gap-1 text-[13.7px] font-semibold text-ink-700">
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
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
        {/* left-0 es obligatorio: sin el, el <button> centra la posicion
            estatica del absolute y el translate-x lo saca del carril. */}
        <span
          className={cn(
            'absolute left-0 top-[3px] h-4 w-4 rounded-full bg-white shadow-soft transition-transform duration-200',
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
  tip,
  children
}: {
  title: string
  action?: React.ReactNode
  tip?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-[11.6px] font-extrabold uppercase tracking-wider text-ink-500">
          {title}
          {tip && <InfoTip text={tip} />}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
