import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { cn } from '@/lib/utils'

/**
 * Barra de titulo propia: la ventana es sin marco (frame: false), asi que
 * ni los controles de Windows ni el arrastre existen hasta que los
 * dibujamos nosotros. Se hace asi (en vez del titleBarOverlay nativo de
 * Windows) porque el overlay solo admite un color plano fijo — no alcanza
 * para el gradiente/hover que usa el resto de los botones de la app, y
 * tampoco deja poner un boton propio (el de ocultar el sidebar) a la
 * izquierda, en la misma franja.
 */
export default function TitleBar(): React.JSX.Element {
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.geni.window.isMaximized().then(setMaximized)
    return window.geni.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div className="drag-region flex h-8 shrink-0 items-center justify-between pl-2">
      <button
        onClick={toggleSidebar}
        title={sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
        className="no-drag grid h-7 w-7 place-items-center rounded-chip text-cobalt-600 transition-colors hover:bg-tint/16"
      >
        <Icon name={sidebarVisible ? 'menu_open' : 'menu'} className="text-[14px]" />
      </button>

      {/* Ancho/alto como los botones nativos de Windows (46x32); el glifo
          adentro se mantiene chico y fino, no crece con la caja. */}
      <div className="no-drag flex h-full">
        <button
          onClick={() => void window.geni.window.minimize()}
          title="Minimizar"
          aria-label="Minimizar"
          className="grid h-8 w-11 place-items-center text-cobalt-600 transition-colors hover:bg-tint/16"
        >
          {/* Linea propia en vez del glifo de icono: "minimize" en Material
              Symbols no queda centrado verticalmente en cajas chicas. */}
          <span className="block h-px w-2.5 rounded-full bg-current" />
        </button>
        <WinButton
          icon={maximized ? 'filter_none' : 'crop_square'}
          label={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => void window.geni.window.toggleMaximize()}
          iconClassName={maximized ? 'text-[9px]' : 'text-[10px]'}
        />
        <WinButton
          icon="close"
          label="Cerrar"
          danger
          iconClassName="text-[11px]"
          onClick={() => void window.geni.window.close()}
        />
      </div>
    </div>
  )
}

function WinButton({
  icon,
  label,
  onClick,
  danger,
  iconClassName
}: {
  icon: string
  label: string
  onClick: () => void
  danger?: boolean
  iconClassName?: string
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-8 w-11 place-items-center text-ink-500 transition-colors',
        danger ? 'hover:bg-rose hover:text-white' : 'text-cobalt-600 hover:bg-tint/16'
      )}
    >
      <Icon name={icon} className={iconClassName} />
    </button>
  )
}
