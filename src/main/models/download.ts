import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { classify, FOLDER_BY_KIND, readSafetensorsHeader } from './detect'
import { modelsRoot, upsertModel } from './manager'
import { getSettings } from '../settings'
import type { DownloadJob, ModelKind } from '@shared/types'

interface Resolved {
  downloadUrl: string
  filename: string
  /** Tipo declarado por la web de origen; se confirma leyendo el archivo. */
  declaredKind: ModelKind
  triggerWords: string[]
  headers: Record<string, string>
  source: 'civitai' | 'huggingface'
}

const CIVITAI_KIND: Record<string, ModelKind> = {
  Checkpoint: 'checkpoint',
  LORA: 'lora',
  LoCon: 'lora',
  DoRA: 'lora',
  TextualInversion: 'embedding',
  VAE: 'vae',
  Controlnet: 'controlnet',
  Upscaler: 'upscale_model'
}

/**
 * Descarga modelos pegando una URL de Civitai o Hugging Face.
 *
 * El tipo que declara la web se usa solo como pista: al terminar se lee la
 * cabecera del archivo y manda lo que diga el archivo, que es la verdad.
 */
class Downloader extends EventEmitter {
  private jobs = new Map<string, DownloadJob>()
  private controllers = new Map<string, AbortController>()

  list(): DownloadJob[] {
    return [...this.jobs.values()]
  }

  private update(id: string, patch: Partial<DownloadJob>): void {
    const job = this.jobs.get(id)
    if (!job) return
    const next = { ...job, ...patch }
    this.jobs.set(id, next)
    this.emit('job', next)
  }

  async start(url: string): Promise<DownloadJob> {
    const id = randomUUID()
    const job: DownloadJob = {
      id,
      url,
      filename: '',
      kind: 'unknown',
      receivedBytes: 0,
      totalBytes: 0,
      state: 'resolving',
      error: null
    }
    this.jobs.set(id, job)
    this.emit('job', job)

    void this.run(id, url)
    return job
  }

  cancel(id: string): void {
    this.controllers.get(id)?.abort()
    this.controllers.delete(id)
    this.update(id, { state: 'cancelled' })
  }

  private async run(id: string, url: string): Promise<void> {
    let partialPath: string | null = null

    try {
      const resolved = await resolveUrl(url)
      this.update(id, {
        filename: resolved.filename,
        kind: resolved.declaredKind,
        state: 'downloading'
      })

      const targetDir = join(modelsRoot(), FOLDER_BY_KIND[resolved.declaredKind])
      await mkdir(targetDir, { recursive: true })

      // Se baja a un .part y solo al final se renombra: si se corta la
      // descarga, ComfyUI nunca ve un archivo a medio escribir.
      partialPath = join(targetDir, `${resolved.filename}.part`)

      const controller = new AbortController()
      this.controllers.set(id, controller)

      const res = await fetch(resolved.downloadUrl, {
        headers: resolved.headers,
        signal: controller.signal,
        redirect: 'follow'
      })
      if (!res.ok || !res.body) {
        throw new Error(`El servidor respondio ${res.status}`)
      }

      const total = Number(res.headers.get('content-length') ?? 0)
      this.update(id, { totalBytes: total })

      let received = 0
      let lastEmit = 0
      const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
      source.on('data', (chunk: Buffer) => {
        received += chunk.length
        // Emitir en cada trozo saturaria el IPC; alcanza 4 veces por segundo.
        const now = Date.now()
        if (now - lastEmit > 250) {
          lastEmit = now
          this.update(id, { receivedBytes: received })
        }
      })

      await pipeline(source, createWriteStream(partialPath))

      const finalPath = join(targetDir, resolved.filename)
      await rename(partialPath, finalPath)
      partialPath = null

      // Ahora si: el archivo decide su propio tipo.
      const header = await readSafetensorsHeader(finalPath)
      const detection = header ? classify(header, finalPath) : null
      const kind = detection && detection.kind !== 'unknown' ? detection.kind : resolved.declaredKind

      let storedPath = finalPath
      if (detection && detection.kind !== 'unknown' && detection.kind !== resolved.declaredKind) {
        // La web mintio (o clasifica distinto): se mueve a la carpeta correcta.
        const correctDir = join(modelsRoot(), FOLDER_BY_KIND[detection.kind])
        await mkdir(correctDir, { recursive: true })
        storedPath = join(correctDir, resolved.filename)
        await rename(finalPath, storedPath)
      }

      const info = await stat(storedPath)
      upsertModel({
        kind,
        architecture: detection?.architecture ?? 'unknown',
        filename: resolved.filename,
        absPath: storedPath,
        sizeBytes: info.size,
        // Los triggers de la web suelen ser mejores que los deducidos.
        triggerWords: resolved.triggerWords.length
          ? resolved.triggerWords
          : (detection?.triggerWords ?? []),
        source: resolved.source,
        sourceUrl: url,
        notes: ''
      })

      this.update(id, { receivedBytes: info.size, kind, state: 'done' })
    } catch (err) {
      if (partialPath) await unlink(partialPath).catch(() => undefined)
      const message = err instanceof Error ? err.message : String(err)
      const aborted = message.includes('abort')
      this.update(id, {
        state: aborted ? 'cancelled' : 'error',
        error: aborted ? null : message
      })
    } finally {
      this.controllers.delete(id)
    }
  }
}

/** Distingue el origen por el dominio y consulta su API. */
async function resolveUrl(raw: string): Promise<Resolved> {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('Esa no es una URL valida')
  }

  // civitai.red es la variante NSFW del mismo sitio; la API que se
  // consulta abajo sigue siendo civitai.com en los dos casos.
  if (url.hostname.endsWith('civitai.com') || url.hostname.endsWith('civitai.red')) {
    return resolveCivitai(url)
  }
  if (url.hostname.endsWith('huggingface.co')) return resolveHuggingFace(url)
  throw new Error('Solo se admiten enlaces de civitai.com, civitai.red o huggingface.co')
}

async function resolveCivitai(url: URL): Promise<Resolved> {
  const token = getSettings().civitaiToken
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  // Acepta tanto /models/123?modelVersionId=456 como /api/download/models/456
  let versionId = url.searchParams.get('modelVersionId')
  const downloadMatch = url.pathname.match(/\/api\/download\/models\/(\d+)/)
  if (downloadMatch) versionId = downloadMatch[1]

  if (!versionId) {
    const modelMatch = url.pathname.match(/\/models\/(\d+)/)
    if (!modelMatch) throw new Error('No pude sacar el id del modelo de esa URL de Civitai')

    const res = await fetch(`https://civitai.com/api/v1/models/${modelMatch[1]}`, { headers })
    if (!res.ok) throw new Error(`Civitai respondio ${res.status} al buscar el modelo`)
    const data = (await res.json()) as { modelVersions?: { id: number }[] }
    versionId = String(data.modelVersions?.[0]?.id ?? '')
    if (!versionId) throw new Error('Ese modelo no tiene versiones descargables')
  }

  const res = await fetch(`https://civitai.com/api/v1/model-versions/${versionId}`, { headers })
  if (!res.ok) throw new Error(`Civitai respondio ${res.status} al buscar la version`)

  const data = (await res.json()) as {
    files?: { name: string; downloadUrl: string; primary?: boolean; type?: string }[]
    trainedWords?: string[]
    model?: { type?: string }
  }

  const file = data.files?.find((f) => f.primary) ?? data.files?.[0]
  if (!file) throw new Error('Esa version no tiene archivos para descargar')

  return {
    downloadUrl: file.downloadUrl,
    filename: file.name,
    declaredKind: CIVITAI_KIND[data.model?.type ?? ''] ?? 'unknown',
    triggerWords: data.trainedWords ?? [],
    headers,
    source: 'civitai'
  }
}

async function resolveHuggingFace(url: URL): Promise<Resolved> {
  const token = getSettings().huggingFaceToken
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  // Formato esperado: /<owner>/<repo>/blob|resolve/<rev>/<ruta del archivo>
  const parts = url.pathname.split('/').filter(Boolean)
  const marker = parts.findIndex((p) => p === 'resolve' || p === 'blob')
  if (marker < 2 || marker + 2 > parts.length) {
    throw new Error(
      'Pega el enlace directo al archivo de Hugging Face (el que incluye /resolve/ o /blob/)'
    )
  }

  const repo = parts.slice(0, marker).join('/')
  const revision = parts[marker + 1]
  const filePath = parts.slice(marker + 2).join('/')
  if (!filePath) throw new Error('Ese enlace no apunta a un archivo concreto')

  return {
    downloadUrl: `https://huggingface.co/${repo}/resolve/${revision}/${filePath}?download=true`,
    filename: filePath.split('/').pop() as string,
    declaredKind: 'unknown',
    triggerWords: [],
    headers,
    source: 'huggingface'
  }
}

export const downloader = new Downloader()
