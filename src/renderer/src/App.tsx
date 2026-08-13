import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import ParamsPanel from './components/ParamsPanel'
import ChatPanel from './components/ChatPanel'
import ConversationList from './components/ConversationList'
import ModelsView from './components/ModelsView'
import Onboarding from './components/Onboarding'
import SettingsDialog from './components/SettingsDialog'

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const settings = useStore((s) => s.settings)
  const bootstrap = useStore((s) => s.bootstrap)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (!ready || !settings) {
    return (
      <div className="grid h-full place-items-center text-[13px] font-bold text-ink-400">
        Cargando GenI...
      </div>
    )
  }

  if (!settings.comfyPath) return <Onboarding />

  return (
    <div className="flex h-full">
      <Sidebar onSettings={() => setShowSettings(true)} />

      {/* Lienzo encajado: radio solo arriba, sin margen abajo (estilo Canva). */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-shell bg-bloom shadow-frame">
        <TopBar />

        {view === 'models' ? (
          <ModelsView />
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Izquierda: parametros + chat. Derecha: conversaciones. */}
            <ParamsPanel />
            <ChatPanel />
            <ConversationList />
          </div>
        )}
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
