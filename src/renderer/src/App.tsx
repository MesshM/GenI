import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SIDEBAR_MAX, SIDEBAR_MIN, useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import TopBar from './components/TopBar'
import ParamsPanel from './components/ParamsPanel'
import ChatPanel from './components/ChatPanel'
import ModelsView from './components/ModelsView'
import PresetsView from './components/PresetsView'
import CollectionsView from './components/CollectionsView'
import Onboarding from './components/Onboarding'
import { Resizer } from './components/ui/resizer'

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const settings = useStore((s) => s.settings)
  const bootstrap = useStore((s) => s.bootstrap)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const sidebarVisible = useStore((s) => s.sidebarVisible)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (!ready || !settings) {
    return (
      <div className="grid h-full place-items-center text-[13.7px] font-bold text-ink-400">
        Cargando GenI...
      </div>
    )
  }

  if (!settings.comfyPath) return <Onboarding />

  return (
    <div className="flex h-full flex-col">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {sidebarVisible && (
            <motion.div
              key="sidebar"
              className="flex min-h-0 shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidebarWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <Sidebar />

              <Resizer
                width={sidebarWidth}
                onResize={setSidebarWidth}
                min={SIDEBAR_MIN}
                max={SIDEBAR_MAX}
                side="right"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lienzo encajado con aire arriba; radio solo en la esquina superior
            izquierda y sin margen abajo, como el shell de Canva. */}
        <div className="mt-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-shell bg-bloom shadow-frame">
          <TopBar />

          {view === 'models' ? (
            <ModelsView />
          ) : view === 'presets' ? (
            <PresetsView />
          ) : view === 'collections' ? (
            <CollectionsView />
          ) : (
            <div className="flex min-h-0 flex-1">
              <ParamsPanel />
              <ChatPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
