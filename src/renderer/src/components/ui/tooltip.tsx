import { useState } from 'react'
import { Icon } from './icon'
import { cn } from '@/lib/utils'

/**
 * Signo de interrogacion que muestra una explicacion al pasar el mouse.
 * Se usa junto a labels de Section/Slider/Select/Switch para que cada
 * parametro tenga su "que hace esto" sin ocupar espacio permanente.
 */
export function InfoTip({ text, className }: { text: string; className?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={cn('group/tip relative inline-flex shrink-0 cursor-help', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Icon
        name="help"
        className="text-[13.7px] text-ink-300 transition-colors hover:text-cobalt-500"
      />
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-[90] mb-2 w-max max-w-[210px] -translate-x-1/2 rounded-box bg-ink-900 px-2.5 py-1.5 text-[11px] font-semibold normal-case leading-snug tracking-normal text-white shadow-deep dark:bg-white dark:text-ink-900"
        >
          {text}
          <span className="absolute left-1/2 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 bg-ink-900 dark:bg-white" />
        </span>
      )}
    </span>
  )
}
