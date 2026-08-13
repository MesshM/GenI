import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { cn, formatBytes } from '@/lib/utils'
import type { ImportResult, ModelKind } from '@shared/types'

const KIND_LABEL: Record<ModelKind, string> = {
  checkpoint: 'Checkpoints',
  lora: 'LoRAs',
  vae: 'VAE',
  text_encoder: 'Codificadores de texto',
  diffusion_model: 'Modelos de difusion',
  controlnet: 'ControlNet',
  embedding: 'Embeddings',
  upscale_model: 'Escaladores',
  unknown: 'Sin clasificar'
}

const KIND_ICON: Record<ModelKind, string> = {
  checkpoint: 'deployed_code',
  lora: 'layers',
  vae: 'filter_center_focus',
  text_encoder: 'text_fields',
  diffusion_model: 'blur_on',
  controlnet: 'tune',
  embedding: 'sell',
  upscale_model: 'zoom_out_map',
  unknown: 'help'
}

const ORDER: ModelKind[] = [
  'checkpoint',
  'diffusion_model',
  'lora',
  'vae',
  'text_encoder',
  'controlnet',
  'embedding',
  'upscale_model',
  'unknown'
]

export default function ModelsView(): React.JSX.Element {
  const models = useStore((s) => s.models)
  const downloads = useStore((s) => s.downloads)
  const refreshModels = useStore((s) => s.refreshModels)

  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function importPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    setBusy(true)
    try {
      const res = await window.geni.models.importPaths(paths)
      setResults(res)
      await refreshModels()
    } finally {
      setBusy(false)
    }
  }

  async function onDrop(e: React.DragEvent): Promise<void> {
    e.preventDefault()
    setDragging(false)
    // Electron 43 quito File.path; la ruta real la resuelve el preload.
    const paths = Array.from(e.dataTransfer.files).map((f) => window.geni.models.pathForFile(f))
    await importPaths(paths.filter(Boolean))
  }

  async function startDownload(): Promise<void> {
    if (!url.trim()) return
    setUrlError(null)
    try {
      await window.geni.models.download(url.trim())
      setUrl('')
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : String(err))
    }
  }

  async function remove(id: string): Promise<void> {
    await window.geni.models.remove(id)
    setConfirmId(null)
    await refreshModels()
  }

  const active = downloads.filter((d) => d.state === 'downloading' || d.state === 'resolving')
  const grouped = ORDER.map((kind) => ({
    kind,
    items: models.filter((m) => m.kind === kind)
  })).filter((g) => g.items.length > 0)

  const target = models.find((m) => m.id === confirmId)

  return (
    <main
      className="scroll min-w-0 flex-1 px-6 pb-6"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={(e) => void onDrop(e)}
    >
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-[22px] font-extrabold tracking-tight text-ink-900">Modelos</h1>
        <p className="mb-5 text-[13px] text-ink-500">
          Arrastra archivos a esta ventana o pega un enlace. La app lee la cabecera del archivo
          para saber que es y lo guarda en la carpeta correcta.
        </p>

        {/* Zona de arrastre */}
        <div
          className={cn(
            'mb-4 rounded-panel border-2 border-dashed p-7 text-center transition-colors',
            dragging
              ? 'border-cobalt-500 bg-tint/14'
              : 'border-line/70 bg-white/40 hover:border-cobalt-500/50'
          )}
        >
          <Icon
            name={dragging ? 'file_download' : 'cloud_upload'}
            className="text-[40px] text-cobalt-500"
          />
          <p className="mt-1.5 text-[14px] font-bold text-ink-800">
            {dragging ? 'Solta los archivos' : 'Arrastra tus .safetensors aca'}
          </p>
          <p className="mt-1 text-[12px] text-ink-500">
            Checkpoints, LoRAs, VAE, codificadores... se detectan solos.
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon="folder_open"
            loading={busy}
            className="mt-3"
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  const res = await window.geni.models.pickAndImport()
                  setResults(res)
                  await refreshModels()
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            Elegir archivos
          </Button>
        </div>

        {/* Descarga por URL */}
        <div className="mb-4 rounded-panel border border-white/70 bg-white/55 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center gap-2">
            <Icon name="link" className="text-[20px] text-cobalt-500" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void startDownload()}
              placeholder="Pega un enlace de Civitai o Hugging Face"
              className="min-w-0 flex-1 rounded-chip border border-line/70 bg-white/80 px-3 py-2 text-[13px] outline-none focus:border-halo/50 focus:ring-4 focus:ring-halo/14"
            />
            <Button size="sm" icon="download" onClick={() => void startDownload()}>
              Descargar
            </Button>
          </div>
          {urlError && <p className="mt-2 text-[12px] font-semibold text-rose-text">{urlError}</p>}

          {active.map((job) => {
            const pct = job.totalBytes ? Math.round((job.receivedBytes / job.totalBytes) * 100) : 0
            return (
              <div key={job.id} className="mt-3 rounded-box bg-white/70 p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate font-bold text-ink-800">
                    {job.filename || 'Resolviendo enlace...'}
                  </span>
                  <span className="shrink-0 text-ink-500">
                    {job.totalBytes
                      ? `${formatBytes(job.receivedBytes)} / ${formatBytes(job.totalBytes)}`
                      : ''}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fog/40">
                  <div
                    className="h-full bg-cta transition-all duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <button
                  onClick={() => void window.geni.models.cancelDownload(job.id)}
                  className="mt-1.5 text-[11px] font-semibold text-ink-400 underline hover:text-rose"
                >
                  Cancelar
                </button>
              </div>
            )
          })}

          {downloads
            .filter((d) => d.state === 'error')
            .map((job) => (
              <p key={job.id} className="mt-2 text-[12px] font-semibold text-rose-text">
                {job.filename || job.url}: {job.error}
              </p>
            ))}
        </div>

        {/* Resultado de la ultima importacion */}
        {results.length > 0 && (
          <div className="mb-4 rounded-panel border border-white/70 bg-white/55 p-3 shadow-soft">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 py-1 text-[12px]">
                <Icon
                  name={r.ok ? 'check_circle' : 'error'}
                  filled
                  className={cn('mt-px text-[16px]', r.ok ? 'text-green' : 'text-rose')}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-ink-800">{r.filename}</span>{' '}
                  {r.ok ? (
                    <span className="text-ink-500">
                      → {KIND_LABEL[r.kind]} ({r.architecture}) · {r.reason}
                    </span>
                  ) : (
                    <span className="text-rose-text">{r.error}</span>
                  )}
                </span>
              </div>
            ))}
            <button
              onClick={() => setResults([])}
              className="mt-1 text-[11px] font-semibold text-ink-400 underline"
            >
              Ocultar
            </button>
          </div>
        )}

        {/* Catalogo */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-extrabold text-ink-700">
            Instalados · {models.length}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            icon="refresh"
            onClick={() => {
              void (async () => {
                await window.geni.models.scan()
                await refreshModels()
              })()
            }}
          >
            Reescanear
          </Button>
        </div>

        {grouped.map((group) => (
          <section key={group.kind} className="mb-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
              <Icon name={KIND_ICON[group.kind]} className="text-[15px]" />
              {KIND_LABEL[group.kind]}
              <span className="text-ink-300">· {group.items.length}</span>
            </h3>

            <div className="space-y-1.5">
              {group.items.map((m) => (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 rounded-box border border-white/70 bg-white/55 px-3 py-2.5 shadow-soft backdrop-blur transition-shadow hover:shadow-lift"
                >
                  <Icon
                    name={KIND_ICON[m.kind]}
                    className="shrink-0 text-[20px] text-cobalt-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink-800">{m.filename}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                      <span>{formatBytes(m.sizeBytes)}</span>
                      {m.architecture !== 'unknown' && (
                        <span className="rounded-full bg-tint/16 px-1.5 py-px font-bold text-cobalt-600">
                          {m.architecture}
                        </span>
                      )}
                      {m.triggerWords.map((w) => (
                        <span
                          key={w}
                          className="rounded-full border border-line/60 px-1.5 py-px font-semibold"
                          title="Trigger word"
                        >
                          {w}
                        </span>
                      ))}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmId(m.id)}
                    title="Eliminar del disco"
                    className="shrink-0 rounded-chip p-1.5 text-ink-300 opacity-0 transition-all hover:bg-rose-bg hover:text-rose group-hover:opacity-100"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}

        {models.length === 0 && (
          <p className="rounded-panel border border-dashed border-line/70 px-4 py-8 text-center text-[13px] text-ink-400">
            Todavia no hay modelos. Arrastra uno o pega un enlace.
          </p>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/25 p-6 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-panel p-5 shadow-deep">
            <h3 className="text-[15px] font-extrabold text-ink-900">Eliminar modelo</h3>
            <p className="mt-2 text-[13px] leading-snug text-ink-600">
              Se borra <span className="font-bold">{target.filename}</span> del disco. Esta accion
              no se puede deshacer y las recetas que lo usen dejaran de estar disponibles.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                Cancelar
              </Button>
              <Button size="sm" variant="danger" onClick={() => void remove(target.id)}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
