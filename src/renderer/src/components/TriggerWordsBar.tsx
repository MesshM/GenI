import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { cn } from '@/lib/utils'

/**
 * Todas las trigger words de las LoRAs activas, agrupadas por LoRA, con
 * copiar individual y "Copiar todo" — como se ven en Civitai. Vive dentro
 * del compositor del prompt, debajo del textarea.
 */
export default function TriggerWordsBar(): React.JSX.Element | null {
  const params = useStore((s) => s.params)
  const models = useStore((s) => s.models)
  const [copied, setCopied] = useState<string | null>(null)

  if (!params) return null

  const groups = params.loras
    .filter((l) => l.enabled)
    .map((l) => ({
      label: l.label,
      words: models.find((m) => m.id === l.modelId)?.triggerWords ?? []
    }))
    .filter((g) => g.words.length > 0)

  if (groups.length === 0) return null

  const allWords = [...new Set(groups.flatMap((g) => g.words))]

  function copy(text: string, key: string): void {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1100)
  }

  return (
    <div className="mb-2 rounded-box border border-white/70 bg-white/45 p-2.5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-ink-400">
          Trigger words
        </span>
        <button
          onClick={() => copy(allWords.join(', '), '__all__')}
          className="flex items-center gap-1 text-[11px] font-bold text-cobalt-600 transition-colors hover:text-cobalt-700"
        >
          <Icon name={copied === '__all__' ? 'check' : 'content_copy'} className="text-[13px]" />
          {copied === '__all__' ? 'Copiado' : 'Copiar todo'}
        </button>
      </div>

      <div className="space-y-1.5">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1">
            <span className="mr-0.5 shrink-0 text-[10.5px] font-bold text-ink-400">
              {g.label}:
            </span>
            {g.words.map((w) => (
              <button
                key={w}
                onClick={() => copy(w, w)}
                title="Copiar"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.8px] font-bold transition-colors',
                  copied === w
                    ? 'border-green/40 bg-green-bg text-green-deep'
                    : 'border-line/60 bg-white/60 text-ink-600 hover:border-cobalt-500/50 hover:text-cobalt-600 dark:bg-white/6'
                )}
              >
                {w}
                <Icon name={copied === w ? 'check' : 'content_copy'} className="text-[11px]" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
