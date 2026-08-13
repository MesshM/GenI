import { useState } from 'react'
import { useStore, type View } from '../store/useStore'
import { Icon } from './ui/icon'
import { cn } from '@/lib/utils'

const NAV: { view: View; icon: string; label: string }[] = [
  { view: 'chat', icon: 'auto_awesome', label: 'Generar' },
  { view: 'models', icon: 'inventory_2', label: 'Modelos' }
]

/**
 * Marco lateral plano (sin tarjeta propia), contraible.
 * El logo es el boton de contraer: cada item se cierra en circulo y el texto
 * se difumina con --wipe, sin que el icono se mueva de su posicion.
 */
export default function Sidebar({ onSettings }: { onSettings: () => void }): React.JSX.Element {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const models = useStore((s) => s.models)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className="group/side flex w-[248px] shrink-0 flex-col px-3 py-4 transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] data-collapsed:w-[80px]"
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Expandir' : 'Contraer'}
        className="no-drag mb-6 flex h-11 items-center gap-2.5 rounded-box px-2 transition-colors hover:bg-white/50"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-cta text-white shadow-blue">
          <Icon name="brush" filled className="text-[20px]" />
        </span>
        <span className="overflow-hidden whitespace-nowrap bg-wordmark bg-clip-text text-[19px] font-extrabold tracking-tight text-transparent transition-opacity duration-200 group-data-collapsed/side:opacity-0">
          GenI
        </span>
      </button>

      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const active = view === item.view
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              title={item.label}
              className={cn(
                'no-drag relative flex h-[46px] items-center rounded-box pl-[13px] pr-4 text-[14px] font-bold transition-[background,color,box-shadow] duration-200 group-data-collapsed/side:pr-[13px]',
                active
                  ? 'bg-white/85 text-cobalt-700 shadow-soft'
                  : 'text-ink-600 hover:bg-white/55 hover:text-ink-800'
              )}
            >
              <Icon
                name={item.icon}
                filled={active}
                className="shrink-0 text-[21px]"
              />
              <span className="ml-3 overflow-hidden whitespace-nowrap transition-opacity duration-200 group-data-collapsed/side:opacity-0">
                {item.label}
              </span>
              {item.view === 'models' && models.length > 0 && (
                <span className="ml-auto rounded-full bg-tint/16 px-2 py-0.5 text-[11px] font-extrabold text-cobalt-600 transition-opacity duration-200 group-data-collapsed/side:opacity-0">
                  {models.length}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      <button
        onClick={onSettings}
        title="Ajustes"
        className="no-drag flex h-[46px] items-center rounded-box pl-[13px] pr-4 text-[14px] font-bold text-ink-600 transition-colors hover:bg-white/55 hover:text-ink-800 group-data-collapsed/side:pr-[13px]"
      >
        <Icon name="settings" className="shrink-0 text-[21px]" />
        <span className="ml-3 overflow-hidden whitespace-nowrap transition-opacity duration-200 group-data-collapsed/side:opacity-0">
          Ajustes
        </span>
      </button>
    </aside>
  )
}
