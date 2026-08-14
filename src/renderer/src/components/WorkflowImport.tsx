import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Icon } from './ui/icon'
import { Button } from './ui/button'
import { Modal, ModalRoot, ModalTrigger } from './ui/modal'
import { TextArea, TextField } from './ui/field'
import { cn } from '@/lib/utils'
import type { WorkflowReport } from '@shared/types'

const KIND_LABEL: Record<string, string> = {
  checkpoint: 'Checkpoint',
  lora: 'LoRA',
  vae: 'VAE',
  text_encoder: 'Codificador',
  diffusion_model: 'Modelo de difusion',
  controlnet: 'ControlNet',
  embedding: 'Embedding',
  upscale_model: 'Escalador',
  unknown: 'Sin identificar'
}

/**
 * Carga un workflow .json de ComfyUI, revisa que modelos necesita y deja
 * bajar los que falten pegando su URL.
 *
 * No se descarga solo: el JSON guarda el nombre del archivo, no de donde
 * salio, asi que no hay forma de adivinar la URL. Lo que si se puede es
 * decir exactamente que falta, que es la parte tediosa de hacer a mano.
 */
export default function WorkflowImport(): React.JSX.Element {
  const downloads = useStore((s) => s.downloads)
  const refreshModels = useStore((s) => s.refreshModels)

  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<WorkflowReport | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [pasted, setPasted] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function pick(): Promise<void> {
    setLoading(true)
    setError('')
    try {
      const result = await window.geni.workflows.pickAndInspect()
      if (result) setReport(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function fromText(text: string): Promise<void> {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      setReport(await window.geni.workflows.inspectText(text))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDrop(e: React.DragEvent): Promise<void> {
    e.preventDefault()
    setDragging(false)

    // El archivo soltado se lee en el renderer y se manda como texto: asi
    // sirve tanto para un .json arrastrado como para texto suelto, sin
    // necesitar la ruta real del archivo.
    const file = e.dataTransfer.files[0]
    if (file) return fromText(await file.text())

    const text = e.dataTransfer.getData('text/plain')
    if (text) return fromText(text)
  }

  async function download(filename: string): Promise<void> {
    const url = urls[filename]?.trim()
    if (!url) return
    try {
      await window.geni.models.download(url)
      setUrls((prev) => ({ ...prev, [filename]: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const missing = report?.requirements.filter((r) => !r.installed) ?? []
  const present = report?.requirements.filter((r) => r.installed) ?? []

  return (
    <ModalRoot isOpen={open} onOpenChange={setOpen}>
      {/* El trigger comparte layoutId con el panel: el boton se convierte en
          el modal al abrir y vuelve a ser boton al cerrar, igual que los
          demas botones que abren modales. */}
      <ModalTrigger radius={999}>
        <Button variant="secondary" icon="upload_file">
          Importar workflow
        </Button>
      </ModalTrigger>

      <Modal
        title="Importar workflow de ComfyUI"
        size="lg"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            {report && missing.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => void refreshModels()}>
                Volver a revisar
              </Button>
            )}
          </>
        }
      >
        {!report ? (
          <>
            <p className="mb-4 text-[13px] leading-snug text-ink-600">
              Trae el workflow que exportaste desde ComfyUI de la forma que te quede mas comoda.
              GenI lo lee, lista los modelos que necesita y te dice cuales ya tienes instalados.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => void onDrop(e)}
              className={cn(
                'mb-4 rounded-box border-2 border-dashed p-6 text-center transition-colors',
                dragging
                  ? 'border-cobalt-500 bg-tint/12'
                  : 'border-line/70 bg-white/40 dark:bg-white/4'
              )}
            >
              <Icon name="upload_file" className="text-[30px] text-ink-300" />
              <p className="mt-1 text-[13px] font-bold text-ink-700">
                Suelta el .json aqui
              </p>
              <p className="mt-0.5 text-[11.6px] text-ink-400">o</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                loading={loading}
                onClick={() => void pick()}
              >
                Elegir archivo
              </Button>
            </div>

            <TextArea
              label="Pegar el JSON"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              onPaste={(e) => {
                // Se procesa apenas se pega, sin obligar a apretar el boton.
                const text = e.clipboardData.getData('text/plain')
                if (text.trim().startsWith('{')) {
                  e.preventDefault()
                  setPasted(text)
                  void fromText(text)
                }
              }}
              placeholder='{ "1": { "class_type": "CheckpointLoaderSimple", ... } }'
            />
            <Button
              size="sm"
              variant="secondary"
              loading={loading}
              disabled={!pasted.trim()}
              onClick={() => void fromText(pasted)}
            >
              Revisar el JSON pegado
            </Button>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-box border border-line/50 bg-white/50 px-3 py-2 text-[12px] dark:bg-white/5">
              <Icon
                name={report.apiFormat ? 'check_circle' : 'warning'}
                filled
                className={cn('text-[16px]', report.apiFormat ? 'text-green' : 'text-amber')}
              />
              <span className="font-bold text-ink-700">
                {report.nodeCount} nodos · {report.apiFormat ? 'formato API' : 'formato interfaz'}
              </span>
              {!report.apiFormat && (
                <span className="w-full text-[11.6px] leading-snug text-ink-500">
                  Este archivo salio del boton <b>Save</b>. Para poder ejecutarlo hace falta el del
                  boton <b>Save (API format)</b>; igual se puede revisar que modelos usa.
                </span>
              )}
            </div>

            {missing.length > 0 && (
              <>
                <p className="mb-2 text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
                  Falta instalar ({missing.length})
                </p>
                <div className="mb-5 grid gap-2">
                  {missing.map((r) => {
                    const job = downloads.find((d) => d.filename === r.filename)
                    return (
                      <div
                        key={r.filename}
                        className="rounded-box border border-amber/30 bg-amber/6 p-2.5"
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <Icon name="download" className="shrink-0 text-[15px] text-amber" />
                          <span className="min-w-0 flex-1 truncate text-[12.6px] font-bold text-ink-800">
                            {r.filename}
                          </span>
                          <span className="shrink-0 text-[10.5px] font-bold text-ink-400">
                            {KIND_LABEL[r.kind] ?? r.kind}
                          </span>
                        </div>

                        {job && job.state !== 'done' ? (
                          <p className="text-[11.6px] font-semibold text-ink-500">
                            {job.state === 'error'
                              ? job.error
                              : job.totalBytes > 0
                                ? `Descargando ${Math.round((job.receivedBytes / job.totalBytes) * 100)}%`
                                : 'Descargando...'}
                          </p>
                        ) : (
                          <div className="flex gap-1.5">
                            <TextField
                              wrapClassName="mb-0 flex-1"
                              value={urls[r.filename] ?? ''}
                              onChange={(e) =>
                                setUrls((prev) => ({ ...prev, [r.filename]: e.target.value }))
                              }
                              placeholder="URL de Civitai o Hugging Face"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!urls[r.filename]?.trim()}
                              onClick={() => void download(r.filename)}
                            >
                              Bajar
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {present.length > 0 && (
              <>
                <p className="mb-2 text-[11.6px] font-bold uppercase tracking-wider text-ink-500">
                  Ya instalado ({present.length})
                </p>
                <div className="grid gap-1">
                  {present.map((r) => (
                    <div
                      key={r.filename}
                      className="flex items-center gap-2 rounded-chip px-2 py-1.5 text-[12.6px]"
                    >
                      <Icon name="check_circle" filled className="shrink-0 text-[15px] text-green" />
                      <span className="min-w-0 flex-1 truncate text-ink-700">{r.filename}</span>
                      <span className="shrink-0 text-[10.5px] font-bold text-ink-400">
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {report.requirements.length === 0 && (
              <p className="text-[13px] text-ink-500">
                Ese workflow no carga ningun modelo por nombre.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] font-semibold text-rose-text">
            <Icon name="error" filled className="mt-px text-[15px]" />
            {error}
          </p>
        )}
      </Modal>
    </ModalRoot>
  )
}
