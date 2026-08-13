import { useState } from 'react'
import { Icon } from './icon'
import { cn } from '@/lib/utils'

/**
 * Traduce el texto actual de espanol a ingles con el modelo local
 * (Helsinki-NLP opus-mt, corre en CPU dentro de la app) y reemplaza el
 * contenido del campo. La primera vez tarda mas porque el modelo se
 * descarga y queda cacheado.
 */
export function TranslateButton({
  text,
  onTranslated,
  className
}: {
  text: string
  onTranslated: (translated: string) => void
  className?: string
}): React.JSX.Element {
  const [loading, setLoading] = useState(false)

  async function run(): Promise<void> {
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      const translated = await window.geni.translate.esToEn(text)
      if (translated) onTranslated(translated)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={!text.trim() || loading}
      title="Traducir de español a inglés"
      className={cn(
        'inline-flex items-center gap-1 text-[11.6px] font-bold text-ink-500 transition-colors hover:text-cobalt-600 disabled:opacity-40 disabled:pointer-events-none',
        className
      )}
    >
      <Icon
        name={loading ? 'progress_activity' : 'translate'}
        className={cn('text-[14.7px]', loading && 'animate-spin-fast')}
      />
      {loading ? 'Traduciendo...' : 'Traducir a ingles'}
    </button>
  )
}
