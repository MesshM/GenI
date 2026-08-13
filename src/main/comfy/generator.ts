import { EventEmitter } from 'node:events'
import { basename, join } from 'node:path'
import { conversationsRepo, generationsRepo, messagesRepo } from '../db/repositories'
import { getSettings } from '../settings'
import { comfyClient, type ComfyImageRef } from './client'
import { getRecipe } from './recipes'
import { buildWorkflow } from './builder'
import { convertPngToWebp } from './webp'
import type { ComfyWorkflow, GenerationProgress, Message, SubmitInput } from '@shared/types'

interface InFlight {
  messageId: string
  /** Titulo legible por id de nodo, para la barra de progreso. */
  labels: Record<string, string>
}

const NODE_LABELS: Record<string, string> = {
  CheckpointLoaderSimple: 'Cargando modelo',
  UNETLoader: 'Cargando modelo',
  LoraLoader: 'Aplicando LoRA',
  DualCLIPLoader: 'Cargando codificadores',
  VAELoader: 'Cargando VAE',
  CLIPSetLastLayer: 'Ajustando CLIP',
  CLIPTextEncode: 'Procesando prompt',
  FluxGuidance: 'Ajustando guia',
  ConditioningZeroOut: 'Preparando negativo',
  EmptyLatentImage: 'Preparando lienzo',
  EmptySD3LatentImage: 'Preparando lienzo',
  LoadImage: 'Leyendo imagen',
  FluxKontextImageScale: 'Ajustando tamano',
  VAEEncode: 'Codificando imagen',
  ReferenceLatent: 'Anclando referencia',
  KSampler: 'Generando',
  LatentUpscale: 'Escalando',
  VAEDecode: 'Decodificando',
  SaveImage: 'Guardando'
}

function labelsFor(workflow: ComfyWorkflow): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [id, node] of Object.entries(workflow)) {
    labels[id] = NODE_LABELS[node.class_type] ?? node.class_type
  }
  return labels
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/** Une la base de datos con ComfyUI y sigue el avance de cada trabajo. */
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
        currentNode: job.labels[e.node] ?? ''
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

  private emitMessage(messageId: string): void {
    const message = messagesRepo.get(messageId)
    if (message) this.emit('message', message)
  }

  async submit(input: SubmitInput): Promise<Message> {
    const recipe = getRecipe(input.presetId)

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
      const workflow = buildWorkflow({
        recipe,
        params,
        prompt: input.prompt,
        negative: input.negative,
        inputImageName: input.inputImagePath,
        conversationId: input.conversationId
      })

      const promptId = await comfyClient.submit(workflow)
      this.inFlight.set(promptId, { messageId: message.id, labels: labelsFor(workflow) })
      messagesRepo.setPromptId(message.id, promptId)
      messagesRepo.setStatus(message.id, 'running')
    } catch (err) {
      messagesRepo.setStatus(
        message.id,
        'error',
        err instanceof Error ? err.message : String(err)
      )
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
      const pngAbsPath = join(outputRoot, img.subfolder ?? '', img.filename)
      const webpAbsPath = await convertPngToWebp(pngAbsPath)

      generationsRepo.create({
        messageId: job.messageId,
        filename: basename(webpAbsPath),
        subfolder: img.subfolder ?? '',
        absPath: webpAbsPath,
        width: message?.params.width ?? 0,
        height: message?.params.height ?? 0,
        seed: message?.params.seed ?? 0
      })
    }

    messagesRepo.setStatus(job.messageId, 'done')
    this.emitMessage(job.messageId)
  }

  async cancel(messageId: string): Promise<void> {
    const found = [...this.inFlight.values()].some((j) => j.messageId === messageId)
    if (found) await comfyClient.interrupt()
  }
}

export const generator = new Generator()
