import { useEffect } from 'react'
import { useStore } from './store/useStore'
import TopBar from './components/TopBar'
import ParamsPanel from './components/ParamsPanel'
import ChatPanel from './components/ChatPanel'
import ConversationList from './components/ConversationList'
import Onboarding from './components/Onboarding'

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const settings = useStore((s) => s.settings)
  const bootstrap = useStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (!ready || !settings) {
    return (
      <div className="flex h-full items-center justify-center text-muted">Cargando GenI...</div>
    )
  }

  // Sin ruta de ComfyUI no hay nada que hacer: primero se configura.
  if (!settings.comfyPath) return <Onboarding />

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {/* Izquierda: parametros + chat, como pidio el diseno. */}
        <ParamsPanel />
        <ChatPanel />
        {/* Derecha: historial de conversaciones. */}
        <ConversationList />
      </div>
    </div>
  )
}
