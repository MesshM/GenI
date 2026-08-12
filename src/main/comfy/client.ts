import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { comfyBaseUrl, getSettings } from '../settings'
import type { ComfyWorkflow } from '@shared/types'

export interface ComfyImageRef {
  filename: string
  subfolder: string
  type: string
}

export interface ExecutionResult {
  images: ComfyImageRef[]
}

interface ProgressEvent {
  promptId: string
  value: number
  max: number
}

interface NodeEvent {
  promptId: string
  node: string | null
}

interface ErrorEvent {
  promptId: string
  message: string
}

interface DoneEvent {
  promptId: string
  images: ComfyImageRef[]
}

/**
 * Habla con ComfyUI: encola trabajos por HTTP y sigue el avance por WebSocket.
 *
 * Node 24 ya trae WebSocket global, asi que no hace falta la dependencia `ws`.
 */
class ComfyClient extends EventEmitter {
  readonly clientId = randomUUID()
  private socket: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private shouldReconnect = false
  /** Imagenes que va dejando cada trabajo, hasta que termina. */
  private collected = new Map<string, ComfyImageRef[]>()

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return

    const s = getSettings()
    const url = `ws://${s.comfyHost}:${s.comfyPort}/ws?clientId=${this.clientId}`
    this.shouldReconnect = true

    try {
      this.socket = new WebSocket(url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.socket.addEventListener('message', (ev) => this.handleMessage(ev))
    this.socket.addEventListener('close', () => {
      this.socket = null
      this.scheduleReconnect()
    })
    this.socket.addEventListener('error', () => {
      this.socket?.close()
    })
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.close()
    this.socket = null
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 2000)
  }

  private handleMessage(ev: MessageEvent): void {
    if (typeof ev.data !== 'string') return // los frames binarios son vistas previas

    let msg: { type: string; data: Record<string, unknown> }
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }

    const promptId = (msg.data?.prompt_id as string) ?? ''

    switch (msg.type) {
      case 'progress':
        this.emit('progress', {
          promptId,
          value: Number(msg.data.value ?? 0),
          max: Number(msg.data.max ?? 1)
        } satisfies ProgressEvent)
        break

      case 'executing': {
        const node = (msg.data.node as string | null) ?? null
        // node === null significa que el trabajo termino.
        if (node === null && promptId) {
          this.emit('done', {
            promptId,
            images: this.collected.get(promptId) ?? []
          } satisfies DoneEvent)
          this.collected.delete(promptId)
        } else {
          this.emit('node', { promptId, node } satisfies NodeEvent)
        }
        break
      }

      case 'executed': {
        const output = msg.data.output as { images?: ComfyImageRef[] } | undefined
        if (output?.images?.length && promptId) {
          const list = this.collected.get(promptId) ?? []
          list.push(...output.images)
          this.collected.set(promptId, list)
        }
        break
      }

      case 'execution_error': {
        const raw = String(msg.data.exception_message ?? 'Error desconocido')
        this.emit('error', { promptId, message: humanizeError(raw) } satisfies ErrorEvent)
        this.collected.delete(promptId)
        break
      }

      case 'execution_interrupted':
        this.emit('interrupted', { promptId })
        this.collected.delete(promptId)
        break
    }
  }

  /** Encola un workflow. Devuelve el prompt_id que asigna ComfyUI. */
  async submit(workflow: ComfyWorkflow): Promise<string> {
    const res = await fetch(`${comfyBaseUrl()}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: this.clientId })
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(parseValidationError(body))
    }

    const data = (await res.json()) as { prompt_id: string }
    return data.prompt_id
  }

  async interrupt(): Promise<void> {
    await fetch(`${comfyBaseUrl()}/interrupt`, { method: 'POST' }).catch(() => undefined)
  }

  /**
   * Red de seguridad: si el WebSocket se cayo justo cuando terminaba el trabajo,
   * el historial dice si salio bien y con que imagenes.
   */
  async fetchHistory(promptId: string): Promise<ExecutionResult | null> {
    try {
      const res = await fetch(`${comfyBaseUrl()}/history/${promptId}`)
      if (!res.ok) return null

      const data = (await res.json()) as Record<
        string,
        { outputs?: Record<string, { images?: ComfyImageRef[] }> }
      >
      const entry = data[promptId]
      if (!entry) return null

      const images = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? [])
      return { images }
    } catch {
      return null
    }
  }
}

/** Traduce los errores mas comunes de ComfyUI a algo accionable. */
function humanizeError(raw: string): string {
  if (/out of memory/i.test(raw)) {
    return 'La GPU se quedo sin memoria. Baja la resolucion o cerra otras aplicaciones que usen la placa.'
  }
  if (/paging file is too small/i.test(raw)) {
    return 'Windows se quedo sin memoria virtual. Activa el archivo de paginacion (Sistema > Configuracion avanzada > Rendimiento > Memoria virtual).'
  }
  if (/not in list|value not in list/i.test(raw)) {
    return `Falta un modelo o archivo que pide este preset. Detalle: ${raw}`
  }
  return raw
}

/** El endpoint /prompt devuelve los errores de validacion nodo por nodo. */
function parseValidationError(body: string): string {
  try {
    const data = JSON.parse(body) as {
      error?: { message?: string }
      node_errors?: Record<string, { errors?: { message?: string; details?: string }[] }>
    }

    const parts: string[] = []
    if (data.error?.message) parts.push(data.error.message)

    for (const [nodeId, info] of Object.entries(data.node_errors ?? {})) {
      for (const e of info.errors ?? []) {
        parts.push(`nodo ${nodeId}: ${e.message ?? ''} ${e.details ?? ''}`.trim())
      }
    }
    return parts.length ? humanizeError(parts.join(' | ')) : body.slice(0, 500)
  } catch {
    return body.slice(0, 500)
  }
}

export const comfyClient = new ComfyClient()
