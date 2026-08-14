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
  /** Id de version de Civitai, o revision de Hugging Face. Para saber si
   *  hay una version mas nueva sin tener que volver a bajar el archivo. */
  sourceVersion: string | null
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
  /** Arquitectura real del modelo base. `architecture` dice como armar el
   *  grafo (SD 1.5 y SDXL se arman igual); esta dice con que LoRAs es
   *  compatible, que no es lo mismo. */
  baseArchitecture: ModelArchitecture
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
  /** Palabras que se anteponen al prompt cuando esta activa. Puede ser mas de una. */
  triggers: string[]
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

/**
 * Una configuracion completa guardada con nombre e imagen de referencia:
 * el modelo, los parametros y el negativo tal como estaban cuando se
 * guardo. Se elige desde el select de Generar, debajo de Modelo.
 */
export interface ParamPreset {
  id: string
  name: string
  recipeId: string
  /** Copia textual del nombre de la receta al momento de guardar: si el
   *  modelo se borra despues, la fila sigue siendo legible. */
  recipeName: string
  params: GenerationParams
  negative: string
  referenceImagePath: string | null
  createdAt: number
}

export interface CreatePresetInput {
  name: string
  recipeId: string
  recipeName: string
  params: GenerationParams
  negative: string
  /** Ruta del archivo elegido por el usuario; se copia a la carpeta de la app. */
  referenceImageSourcePath?: string
}

// --------------------------------------------------------- colecciones

/**
 * Una coleccion agrupa imagenes ya generadas y, opcionalmente, recuerda
 * con que receta se hicieron. Lo segundo es lo que permite abrir una
 * conversacion nueva que siga la misma linea visual.
 */
export interface Collection {
  id: string
  name: string
  description: string
  /** Parametros heredados al abrir una conversacion desde la coleccion. */
  params: GenerationParams | null
  promptTemplate: string
  negativeTemplate: string
  recipeId: string | null
  /** Si esta, gana sobre `params`: se aplica el preset guardado. */
  presetId: string | null
  lockedSeed: number | null
  createdAt: number
  itemCount: number
  /** Ruta de la primera imagen, para la portada de la tarjeta. */
  cover: string | null
}

/** Una imagen dentro de una coleccion, con el contexto de donde salio. */
export interface CollectionItem {
  id: string
  generationId: string
  absPath: string
  width: number
  height: number
  seed: number
  prompt: string
  negative: string
  conversationId: string
  conversationTitle: string
  addedAt: number
}

export interface CreateCollectionInput {
  name: string
  description?: string
  /** Toma los parametros de este mensaje como receta de la coleccion. */
  fromMessageId?: string
  promptTemplate?: string
  negativeTemplate?: string
  presetId?: string | null
  lockedSeed?: number | null
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

/** Un modelo que pide un workflow importado. */
export interface WorkflowRequirement {
  filename: string
  kind: ModelKind
  installed: boolean
}

export interface WorkflowReport {
  /** Solo el formato de API se puede mandar a ComfyUI tal cual. */
  apiFormat: boolean
  nodeCount: number
  requirements: WorkflowRequirement[]
  workflow: ComfyWorkflow | null
}

/** Marca de la placa de video: decide que rueda de PyTorch se instala. */
export type GpuVendor = 'amd' | 'nvidia' | 'unknown'

export interface ComfyInstallProgress {
  step: string
  log: string
  /** -1 cuando el paso no tiene porcentaje medible. */
  percent: number
  done: boolean
  error: string | null
  /** Al terminar, el Python del entorno recien creado. */
  pythonPath?: string
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
    /** Carpeta vacia donde instalar ComfyUI desde cero. */
    pickInstallFolder(): Promise<string | null>
  }
  workflows: {
    /** Abre un .json de ComfyUI y dice que modelos le faltan. */
    pickAndInspect(): Promise<WorkflowReport | null>
  }
  install: {
    /** Que hay en la maquina antes de instalar: placa, Python y ruta sugerida. */
    detectEnv(): Promise<{
      gpu: GpuVendor
      python: string | null
      suggestedDir: string
    }>
    comfy(targetDir: string): Promise<string>
    onProgress(cb: (p: ComfyInstallProgress) => void): () => void
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
  presets: {
    list(): Promise<ParamPreset[]>
    create(input: CreatePresetInput): Promise<ParamPreset>
    remove(id: string): Promise<void>
    pickReferenceImage(): Promise<string | null>
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
    /** Descomprime la carpeta de imagenes de la conversacion (si estaba comprimida). */
    decompress(id: string): Promise<void>
    /** Comprime la carpeta de imagenes de la conversacion en un .zip. */
    compress(id: string): Promise<void>
    /** Recuerda cual es la activa, para saber que comprimir al cerrar la app. */
    setActive(id: string): Promise<void>
  }
  collections: {
    list(): Promise<Collection[]>
    create(input: CreateCollectionInput): Promise<Collection>
    update(
      id: string,
      patch: {
        name?: string
        description?: string
        promptTemplate?: string
        negativeTemplate?: string
        presetId?: string | null
        lockedSeed?: number | null
      }
    ): Promise<Collection | null>
    remove(id: string): Promise<void>
    items(collectionId: string): Promise<CollectionItem[]>
    add(collectionId: string, generationIds: string[]): Promise<void>
    removeItem(collectionId: string, generationId: string): Promise<void>
    /** Ids de las colecciones que ya contienen esa imagen. */
    forGeneration(generationId: string): Promise<string[]>
    /** Crea una conversacion nueva con los parametros de la coleccion. */
    startConversation(collectionId: string): Promise<Conversation>
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
  translate: {
    /** Traduce espanol a ingles con un modelo local (Helsinki-NLP opus-mt). */
    esToEn(text: string): Promise<string>
  }
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
  }
}
