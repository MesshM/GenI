// Tipos compartidos por main, preload y renderer.
// Es el unico lugar donde se define el contrato entre procesos.

/** Un workflow de ComfyUI en formato API: id de nodo -> definicion. */
export interface ComfyNode {
  class_type: string
  inputs: Record<string, unknown>
}
export type ComfyWorkflow = Record<string, ComfyNode>

/** Apunta a un input concreto de un nodo del workflow. */
export interface NodeTarget {
  node: string
  input: string
}

/**
 * Que control de la interfaz escribe en que nodo.
 * Un parametro puede apuntar a varios nodos: la seed, por ejemplo, va a las
 * dos pasadas del hires fix para que ambas usen el mismo valor.
 */
export interface ParamMap {
  positive?: NodeTarget[]
  negative?: NodeTarget[]
  width?: NodeTarget[]
  height?: NodeTarget[]
  /** Resolucion de la pasada base, cuando el preset usa hires fix. */
  baseWidth?: NodeTarget[]
  baseHeight?: NodeTarget[]
  seed?: NodeTarget[]
  steps?: NodeTarget[]
  cfg?: NodeTarget[]
  samplerName?: NodeTarget[]
  scheduler?: NodeTarget[]
  denoise?: NodeTarget[]
  batchSize?: NodeTarget[]
  /** Imagen de entrada, solo en presets de edicion. */
  inputImage?: NodeTarget[]
  loras?: LoraSlot[]
}

export interface LoraSlot {
  node: string
  label: string
  /** Palabra que hay que meter en el prompt para activarla, si tiene. */
  trigger?: string
}

export type PresetKind = 'txt2img' | 'img2img'

export interface Preset {
  id: string
  name: string
  description: string
  kind: PresetKind
  workflow: ComfyWorkflow
  paramMap: ParamMap
  defaults: GenerationParams
  /** Resoluciones sugeridas en la interfaz. */
  resolutions: { label: string; width: number; height: number }[]
  builtin: boolean
  sortOrder: number
}

export interface LoraSetting {
  node: string
  label: string
  strength: number
  enabled: boolean
  trigger?: string
}

export interface GenerationParams {
  width: number
  height: number
  steps: number
  cfg: number
  samplerName: string
  scheduler: string
  seed: number
  /** Si es true se sortea una seed nueva en cada envio. */
  randomSeed: boolean
  batchSize: number
  denoise?: number
  loras: LoraSetting[]
}

export type MessageStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled'
export type MessageRole = 'user' | 'assistant'

export interface Generation {
  id: string
  messageId: string
  filename: string
  subfolder: string
  absPath: string
  width: number
  height: number
  seed: number
  createdAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  prompt: string
  negative: string
  params: GenerationParams
  presetId: string
  status: MessageStatus
  error: string | null
  promptId: string | null
  createdAt: number
  generations: Generation[]
}

export interface Conversation {
  id: string
  title: string
  presetId: string
  createdAt: number
  updatedAt: number
  /** Primera imagen de la conversacion, para la miniatura de la lista. */
  thumbnail: string | null
  messageCount: number
}

export interface AppSettings {
  comfyPath: string
  pythonPath: string
  launchArgs: string
  autoStartComfy: boolean
  comfyHost: string
  comfyPort: number
  theme: 'dark' | 'light'
}

export type ComfyStatus =
  | { state: 'stopped' }
  | { state: 'starting'; log: string[] }
  | { state: 'ready'; device: string; vramTotalMb: number }
  | { state: 'error'; message: string; log: string[] }

export interface GenerationProgress {
  messageId: string
  /** Paso actual dentro del muestreador. */
  value: number
  max: number
  /** Titulo legible del nodo que se esta ejecutando. */
  currentNode: string
}

export interface UpdateInfo {
  available: boolean
  version: string | null
  downloading: boolean
  downloaded: boolean
  percent: number
  error: string | null
}

/** Lo que el renderer puede pedir al proceso principal. */
export interface GenIApi {
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    pickComfyFolder(): Promise<string | null>
    detectComfy(): Promise<string | null>
  }
  comfy: {
    status(): Promise<ComfyStatus>
    start(): Promise<ComfyStatus>
    stop(): Promise<void>
    onStatus(cb: (s: ComfyStatus) => void): () => void
  }
  presets: {
    list(): Promise<Preset[]>
  }
  conversations: {
    list(): Promise<Conversation[]>
    create(presetId: string): Promise<Conversation>
    rename(id: string, title: string): Promise<void>
    remove(id: string): Promise<void>
    messages(id: string): Promise<Message[]>
  }
  generate: {
    submit(input: SubmitInput): Promise<Message>
    cancel(messageId: string): Promise<void>
    onProgress(cb: (p: GenerationProgress) => void): () => void
    onMessageUpdate(cb: (m: Message) => void): () => void
  }
  images: {
    reveal(absPath: string): Promise<void>
    copy(absPath: string): Promise<void>
    saveAs(absPath: string): Promise<string | null>
  }
  updates: {
    check(): Promise<UpdateInfo>
    download(): Promise<void>
    install(): Promise<void>
    onState(cb: (u: UpdateInfo) => void): () => void
  }
  app: {
    version(): Promise<string>
  }
}

export interface SubmitInput {
  conversationId: string
  presetId: string
  prompt: string
  negative: string
  params: GenerationParams
  /** Ruta absoluta de la imagen de entrada, solo para presets img2img. */
  inputImagePath?: string
}
