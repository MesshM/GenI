interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  hint?: string
}

/** Deslizador con el valor editable a mano, como en Civitai. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint
}: SliderProps): React.JSX.Element {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-right text-xs outline-none focus:border-accent"
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
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

interface SelectProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange
}: SelectProps<T>): React.JSX.Element {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </section>
  )
}
