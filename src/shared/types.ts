// Tipos compartidos por main, preload y renderer.
// Es el unico lugar donde se define el contrato entre procesos.

/** Un workflow de ComfyUI en formato API: id de nodo -> definicion. */
export interface ComfyNode {
  class_type: string
  inputs: Record<string, unknown>
}
export type ComfyWorkflow = Record<string, ComfyNode>

// ------------------------------------------------------------- modelos

export type ModelKind =
  | 'checkpoint'
  | 'lora'
  | 'vae'
  | 'text_encoder'
  | 'diffusion_model'
  | 'controlnet'
  | 'embedding'
  | 'upscale_model'
  | 'unknown'

export type ModelArchitecture = 'sdxl' | 'sd15' | 'flux' | 'unknown'

export interface ModelAsset {
  id: string
  kind: ModelKind
  architecture: ModelArchitecture
  /** Nombre del archivo tal como lo ve ComfyUI. */
  filename: string
  absPath: string
  sizeBytes: number
  /** Palabras que activan la LoRA. Editables por el usuario. */
  triggerWords: string[]
  source: 'scan' | 'import' | 'civitai' | 'huggingface'
  sourceUrl: string | null
  notes: string
  createdAt: number
}

export interface ImportResult {
  ok: boolean
  filename: string
  kind: ModelKind
  architecture: ModelArchitecture
  reason: string
  error?: string
}

export interface DownloadJob {
  id: string
  url: string
  filename: string
  kind: ModelKind
  receivedBytes: number
  totalBytes: number
  state: 'resolving' | 'downloading' | 'done' | 'error' | 'cancelled'
  error: string | null
}

// ------------------------------------------------------------- recetas

/** Cada arquitectura arma el grafo de forma distinta. */
export type RecipeArchitecture = 'sdxl' | 'flux' | 'flux-kontext'

/**
 * Una receta es "que modelos usar y como conectarlos". La app genera el
 * workflow a partir de esto, asi que agregar o quitar una LoRA no requiere
 * tocar ningun JSON.
 */
export interface Recipe {
  id: string
  name: string
  description: string
  architecture: RecipeArchitecture
  /** SDXL: checkpoint todo en uno. */
  checkpoint?: string
  /** FLUX: modelo de difusion + codificadores + VAE por separado. */
  unet?: string
  clipL?: string
  clipT5?: string
  vae?: string
  weightDtype?: 'default' | 'fp8_e4m3fn' | 'fp8_e4m3fn_fast' | 'fp8_e5m2'
  /** Negativo para saltarse capas finales de CLIP (-2 es lo habitual en anime). */
  clipSkip?: number
  defaults: GenerationParams
  negativeDefault: string
  resolutions: { label: string; width: number; height: number }[]
  builtin: boolean
  sortOrder: number
}

export interface LoraSetting {
  /** Id del modelo en el catalogo. */
  modelId: string
  /** Nombre del archivo tal como lo espera ComfyUI. */
  filename: string
  label: string
  strength: number
  enabled: boolean
  /** Palabra que se antepone al prompt cuando esta activa. */
  trigger?: string
}

export interface GenerationParams {
  width: number
  height: number
  steps: number
  /** Pasos de la segunda pasada; si falta se calcula desde `steps`. */
  hiresSteps?: number
  cfg: number
  samplerName: string
  scheduler: string
  seed: number
  randomSeed: boolean
  batchSize: number
  denoise?: number
  loras: LoraSetting[]
}

// ------------------------------------------------------------ mensajes

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
  /** Solo para descargar modelos con licencia restringida. */
  civitaiToken: string
  huggingFaceToken: string
}

export type ComfyStatus =
  | { state: 'stopped' }
  | { state: 'starting'; log: string[] }
  | { state: 'ready'; device: string; vramTotalMb: number }
  | { state: 'error'; message: string; log: string[] }

export interface GenerationProgress {
  messageId: string
  value: number
  max: number
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

export interface SubmitInput {
  conversationId: string
  presetId: string
  prompt: string
  negative: string
  params: GenerationParams
  inputImagePath?: string
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
  recipes: {
    list(): Promise<Recipe[]>
  }
  models: {
    list(): Promise<ModelAsset[]>
    scan(): Promise<{ found: number; removed: number }>
    /** Importa archivos arrastrados a la ventana. */
    importPaths(paths: string[]): Promise<ImportResult[]>
    /** Ruta real de un File soltado en la ventana (File.path ya no existe). */
    pathForFile(file: File): string
    /** Abre el dialogo del sistema para elegir archivos. */
    pickAndImport(): Promise<ImportResult[]>
    remove(id: string): Promise<void>
    update(id: string, patch: { triggerWords?: string[]; notes?: string }): Promise<ModelAsset | null>
    download(url: string): Promise<DownloadJob>
    cancelDownload(id: string): Promise<void>
    downloads(): Promise<DownloadJob[]>
    onDownload(cb: (job: DownloadJob) => void): () => void
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
