import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { conversationsRepo, generationsRepo, messagesRepo } from '../db/repositories'
import { getSettings } from '../settings'
import { comfyClient, type ComfyImageRef } from './client'
import { getPreset } from './presets'
import { buildWorkflow, randomSeed } from './workflow'
import type { GenerationProgress, Message, SubmitInput } from '@shared/types'

/** Trabajos en vuelo, indexados por el prompt_id que devolvio ComfyUI. */
interface InFlight {
  messageId: string
  presetId: string
}

/**
 * Une la base de datos con ComfyUI: crea el mensaje, arma y encola el workflow,
 * sigue el avance y guarda los resultados.
 */
class Generator extends EventEmitter {
  private inFlight = new Map<string, InFlight>()

  constructor() {
    super()
    comfyClient.on('progress', (e: { promptId: string; value: number; max: number }) => {
      const job = this.inFlight.get(e.promptId)
      if (!job) return
      this.emit('progress', {
        messageId: job.messageId,
        value: e.value,
        max: e.max,
        currentNode: ''
      } satisfies GenerationProgress)
    })

    comfyClient.on('node', (e: { promptId: string; node: string | null }) => {
      const job = this.inFlight.get(e.promptId)
      if (!job || !e.node) return
      this.emit('progress', {
        messageId: job.messageId,
        value: 0,
        max: 0,
        currentNode: this.nodeLabel(job.presetId, e.node)
      } satisfies GenerationProgress)
    })

    comfyClient.on('done', (e: { promptId: string; images: ComfyImageRef[] }) => {
      void this.finish(e.promptId, e.images)
    })

    comfyClient.on('error', (e: { promptId: string; message: string }) => {
      const job = this.inFlight.get(e.promptId)
      if (!job) return
      this.inFlight.delete(e.promptId)
      messagesRepo.setStatus(job.messageId, 'error', e.message)
      this.emitMessage(job.messageId)
    })

    comfyClient.on('interrupted', (e: { promptId: string }) => {
      const job = this.inFlight.get(e.promptId)
      if (!job) return
      this.inFlight.delete(e.promptId)
      messagesRepo.setStatus(job.messageId, 'cancelled')
      this.emitMessage(job.messageId)
    })
  }

  /** Nombre legible del nodo que se esta ejecutando, para la barra de progreso. */
  private nodeLabel(presetId: string, nodeId: string): string {
    try {
      const node = getPreset(presetId).workflow[nodeId]
      if (!node) return ''
      const friendly: Record<string, string> = {
        CheckpointLoaderSimple: 'Cargando modelo',
        UNETLoader: 'Cargando modelo',
        LoraLoader: 'Aplicando LoRA',
        DualCLIPLoader: 'Cargando codificadores de texto',
        VAELoader: 'Cargando VAE',
        CLIPTextEncode: 'Procesando prompt',
        EmptyLatentImage: 'Preparando lienzo',
        EmptySD3LatentImage: 'Preparando lienzo',
        KSampler: 'Generando',
        LatentUpscale: 'Escalando',
        VAEDecode: 'Decodificando imagen',
        SaveImage: 'Guardando'
      }
      return friendly[node.class_type] ?? node.class_type
    } catch {
      return ''
    }
  }

  private emitMessage(messageId: string): void {
    const message = messagesRepo.get(messageId)
    if (message) this.emit('message', message)
  }

  async submit(input: SubmitInput): Promise<Message> {
    const preset = getPreset(input.presetId)

    const params = { ...input.params }
    if (params.randomSeed) params.seed = randomSeed()

    const message = messagesRepo.create({
      conversationId: input.conversationId,
      role: 'user',
      prompt: input.prompt,
      negative: input.negative,
      params,
      presetId: input.presetId,
      status: 'pending'
    })

    conversationsRepo.autoTitle(input.conversationId, input.prompt)

    try {
      const workflow = buildWorkflow(
        preset,
        params,
        input.prompt,
        input.negative,
        input.inputImagePath
      )

      const promptId = await comfyClient.submit(workflow)
      this.inFlight.set(promptId, { messageId: message.id, presetId: input.presetId })
      messagesRepo.setPromptId(message.id, promptId)
      messagesRepo.setStatus(message.id, 'running')
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      messagesRepo.setStatus(message.id, 'error', detail)
    }

    const saved = messagesRepo.get(message.id)
    if (saved) this.emit('message', saved)
    return saved ?? message
  }

  private async finish(promptId: string, images: ComfyImageRef[]): Promise<void> {
    const job = this.inFlight.get(promptId)
    if (!job) return
    this.inFlight.delete(promptId)

    // Si el WebSocket perdio algun evento, el historial tiene la verdad.
    let list = images
    if (list.length === 0) {
      const history = await comfyClient.fetchHistory(promptId)
      list = history?.images ?? []
    }

    if (list.length === 0) {
      messagesRepo.setStatus(job.messageId, 'error', 'ComfyUI termino sin devolver imagenes')
      this.emitMessage(job.messageId)
      return
    }

    const message = messagesRepo.get(job.messageId)
    const outputRoot = join(getSettings().comfyPath, 'output')

    for (const img of list) {
      generationsRepo.create({
        messageId: job.messageId,
        filename: img.filename,
        subfolder: img.subfolder ?? '',
        absPath: join(outputRoot, img.subfolder ?? '', img.filename),
        width: message?.params.width ?? 0,
        height: message?.params.height ?? 0,
        seed: message?.params.seed ?? 0
      })
    }

    messagesRepo.setStatus(job.messageId, 'done')
    this.emitMessage(job.messageId)
  }

  async cancel(messageId: string): Promise<void> {
    const entry = [...this.inFlight.entries()].find(([, j]) => j.messageId === messageId)
    if (!entry) return
    await comfyClient.interrupt()
  }
}

export const generator = new Generator()
