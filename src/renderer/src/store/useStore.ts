import { create } from 'zustand'
import { applyTheme } from '../lib/theme'
import type {
  AppSettings,
  ComfyStatus,
  Conversation,
  CreatePresetInput,
  DownloadJob,
  GenerationParams,
  GenerationProgress,
  LoraSetting,
  Message,
  ModelAsset,
  ParamPreset,
  Recipe,
  UpdateInfo
} from '@shared/types'

export type View = 'chat' | 'models' | 'presets'

/** Limites de los paneles redimensionables. */
export const SIDEBAR_MIN = 210
export const SIDEBAR_MAX = 420
export const PARAMS_MIN = 280
export const PARAMS_MAX = 560

// El ancho de los paneles es preferencia de interfaz, no dato de la app:
// va en localStorage y no en la base ni en los ajustes sincronizados.
const WIDTH_KEY = 'geni:widths'

function loadWidths(): { sidebar: number; params: number } {
  try {
    const raw = localStorage.getItem(WIDTH_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { sidebar?: number; params?: number }
      return {
        sidebar: clamp(parsed.sidebar ?? 262, SIDEBAR_MIN, SIDEBAR_MAX),
        params: clamp(parsed.params ?? 340, PARAMS_MIN, PARAMS_MAX)
      }
    }
  } catch {
    // preferencia corrupta: se vuelve a los valores por defecto
  }
  return { sidebar: 262, params: 340 }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function persistWidths(sidebar: number, params: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, JSON.stringify({ sidebar, params }))
  } catch {
    // sin localStorage la app funciona igual, solo no recuerda el ancho
  }
}

interface State {
  ready: boolean
  view: View
  settings: AppSettings | null
  comfy: ComfyStatus
  update: UpdateInfo | null

  recipes: Recipe[]
  models: ModelAsset[]
  downloads: DownloadJob[]
  presets: ParamPreset[]

  conversations: Conversation[]
  activeId: string | null
  messages: Message[]
  progress: Record<string, GenerationProgress>

  prompt: string
  negative: string
  params: GenerationParams | null
  recipeId: string | null

  sidebarWidth: number
  paramsWidth: number
  setSidebarWidth: (w: number) => void
  setParamsWidth: (w: number) => void

  setView: (v: View) => void
  bootstrap: () => Promise<void>
  refreshModels: () => Promise<void>

  selectConversation: (id: string) => Promise<void>
  newConversation: (recipeId?: string) => Promise<void>
  removeConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>

  chooseRecipe: (recipeId: string) => void
  /** Carga un preset guardado: cambia de receta si hace falta y trae sus parametros. */
  applyPreset: (presetId: string) => void
  refreshPresets: () => Promise<void>
  createPreset: (input: Omit<CreatePresetInput, 'params' | 'negative' | 'recipeId' | 'recipeName'>) => Promise<void>
  removePreset: (id: string) => Promise<void>
  setPrompt: (v: string) => void
  setNegative: (v: string) => void
  patchParams: (patch: Partial<GenerationParams>) => void
  addLora: (modelId: string) => void
  removeLora: (modelId: string) => void
  patchLora: (modelId: string, patch: Partial<LoraSetting>) => void
  loadParamsFrom: (message: Message) => void

  send: () => Promise<void>
  cancel: (messageId: string) => Promise<void>
  refreshSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  view: 'chat',
  settings: null,
  comfy: { state: 'stopped' },
  update: null,

  recipes: [],
  models: [],
  downloads: [],
  presets: [],

  conversations: [],
  activeId: null,
  messages: [],
  progress: {},

  prompt: '',
  negative: '',
  params: null,
  recipeId: null,

  sidebarWidth: loadWidths().sidebar,
  paramsWidth: loadWidths().params,

  setSidebarWidth(w) {
    set({ sidebarWidth: w })
    persistWidths(w, get().paramsWidth)
  },

  setParamsWidth(w) {
    set({ paramsWidth: w })
    persistWidths(get().sidebarWidth, w)
  },

  setView: (view) => set({ view }),

  async bootstrap() {
    const settings = await window.geni.settings.get()
    applyTheme(settings.theme)

    // Sin ruta de ComfyUI no hay carpetas que escanear todavia.
    if (settings.comfyPath) await window.geni.models.scan()

    const [recipes, models, conversations, comfy, downloads, presets] = await Promise.all([
      window.geni.recipes.list(),
      window.geni.models.list(),
      window.geni.conversations.list(),
      window.geni.comfy.status(),
      window.geni.models.downloads(),
      window.geni.presets.list()
    ])

    const first = recipes[0] ?? null
    set({
      settings,
      recipes,
      models,
      conversations,
      comfy,
      downloads,
      presets,
      recipeId: first?.id ?? null,
      params: first ? structuredClone(first.defaults) : null,
      negative: first?.negativeDefault ?? '',
      ready: true
    })

    window.geni.comfy.onStatus((s) => set({ comfy: s }))
    window.geni.updates.onState((u) => set({ update: u }))

    window.geni.models.onDownload((job) => {
      set((state) => {
        const downloads = state.downloads.some((d) => d.id === job.id)
          ? state.downloads.map((d) => (d.id === job.id ? job : d))
          : [...state.downloads, job]
        return { downloads }
      })
      // Al terminar, el catalogo y las recetas cambian.
      if (job.state === 'done') void get().refreshModels()
    })

    window.geni.generate.onProgress((p) => {
      set((state) => ({ progress: { ...state.progress, [p.messageId]: p } }))
    })

    window.geni.generate.onMessageUpdate((m) => {
      set((state) => {
        const messages = state.messages.some((x) => x.id === m.id)
          ? state.messages.map((x) => (x.id === m.id ? m : x))
          : state.activeId === m.conversationId
            ? [...state.messages, m]
            : state.messages

        const progress = { ...state.progress }
        if (m.status !== 'running' && m.status !== 'pending') delete progress[m.id]
        return { messages, progress }
      })
      void window.geni.conversations.list().then((conversations) => set({ conversations }))
    })

    if (conversations[0]) await get().selectConversation(conversations[0].id)
  },

  async refreshModels() {
    const [models, recipes] = await Promise.all([
      window.geni.models.list(),
      window.geni.recipes.list()
    ])
    set((state) => ({
      models,
      recipes,
      // Si la receta activa desaparecio (borraron su modelo), cae a la primera.
      recipeId: recipes.some((r) => r.id === state.recipeId)
        ? state.recipeId
        : (recipes[0]?.id ?? null)
    }))
  },

  async selectConversation(id) {
    const messages = await window.geni.conversations.messages(id)
    const conversation = get().conversations.find((c) => c.id === id)
    const recipe = get().recipes.find((r) => r.id === conversation?.presetId)

    set({
      activeId: id,
      messages,
      recipeId: recipe?.id ?? get().recipeId,
      params: recipe ? structuredClone(recipe.defaults) : get().params,
      negative: recipe?.negativeDefault ?? get().negative
    })
  },

  async newConversation(recipeId) {
    const id = recipeId ?? get().recipeId ?? get().recipes[0]?.id
    if (!id) return

    const conversation = await window.geni.conversations.create(id)
    const recipe = get().recipes.find((r) => r.id === id)

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeId: conversation.id,
      messages: [],
      recipeId: id,
      params: recipe ? structuredClone(recipe.defaults) : state.params,
      negative: recipe?.negativeDefault ?? state.negative,
      prompt: '',
      view: 'chat'
    }))
  },

  async removeConversation(id) {
    await window.geni.conversations.remove(id)
    const conversations = await window.geni.conversations.list()
    const active = get().activeId === id ? (conversations[0]?.id ?? null) : get().activeId

    set({ conversations, activeId: active, messages: [] })
    if (active) await get().selectConversation(active)
  },

  async renameConversation(id, title) {
    await window.geni.conversations.rename(id, title)
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c))
    }))
  },

  chooseRecipe(recipeId) {
    const recipe = get().recipes.find((r) => r.id === recipeId)
    if (!recipe) return
    set({
      recipeId,
      params: structuredClone(recipe.defaults),
      negative: recipe.negativeDefault
    })
  },

  applyPreset(presetId) {
    const preset = get().presets.find((p) => p.id === presetId)
    if (!preset) return
    // Si el modelo que usaba ya no esta instalado, no hay a que cambiar:
    // se deja la receta actual y solo se avisa via el filtrado del Select.
    const recipeExists = get().recipes.some((r) => r.id === preset.recipeId)
    set({
      recipeId: recipeExists ? preset.recipeId : get().recipeId,
      params: structuredClone(preset.params),
      negative: preset.negative
    })
  },

  async refreshPresets() {
    const presets = await window.geni.presets.list()
    set({ presets })
  },

  async createPreset(input) {
    const { recipeId, recipes, params, negative } = get()
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipeId || !params || !recipe) return

    await window.geni.presets.create({
      ...input,
      recipeId,
      recipeName: recipe.name,
      params,
      negative
    })
    await get().refreshPresets()
  },

  async removePreset(id) {
    await window.geni.presets.remove(id)
    set((state) => ({ presets: state.presets.filter((p) => p.id !== id) }))
  },

  setPrompt: (v) => set({ prompt: v }),
  setNegative: (v) => set({ negative: v }),

  patchParams(patch) {
    set((state) => (state.params ? { params: { ...state.params, ...patch } } : {}))
  },

  addLora(modelId) {
    const model = get().models.find((m) => m.id === modelId)
    const params = get().params
    if (!model || !params) return
    if (params.loras.some((l) => l.modelId === modelId)) return

    const lora: LoraSetting = {
      modelId,
      filename: model.filename,
      label: model.filename.replace(/\.[^.]+$/, ''),
      strength: 0.8,
      enabled: true,
      trigger: model.triggerWords[0]
    }
    set({ params: { ...params, loras: [...params.loras, lora] } })
  },

  removeLora(modelId) {
    const params = get().params
    if (!params) return
    set({ params: { ...params, loras: params.loras.filter((l) => l.modelId !== modelId) } })
  },

  patchLora(modelId, patch) {
    const params = get().params
    if (!params) return
    set({
      params: {
        ...params,
        loras: params.loras.map((l) => (l.modelId === modelId ? { ...l, ...patch } : l))
      }
    })
  },

  loadParamsFrom(message) {
    set({
      params: structuredClone(message.params),
      prompt: message.prompt,
      negative: message.negative,
      recipeId: message.presetId,
      view: 'chat'
    })
  },

  async send() {
    const { activeId, recipeId, params, prompt, negative } = get()
    if (!recipeId || !params || !prompt.trim()) return

    let conversationId = activeId
    if (!conversationId) {
      await get().newConversation(recipeId)
      conversationId = get().activeId
    }
    if (!conversationId) return

    const message = await window.geni.generate.submit({
      conversationId,
      presetId: recipeId,
      prompt,
      negative,
      params
    })

    set((state) => ({
      messages: state.messages.some((m) => m.id === message.id)
        ? state.messages
        : [...state.messages, message],
      prompt: ''
    }))

    const conversations = await window.geni.conversations.list()
    set({ conversations })
  },

  async cancel(messageId) {
    await window.geni.generate.cancel(messageId)
  },

  async refreshSettings(patch) {
    const settings = await window.geni.settings.update(patch)
    applyTheme(settings.theme)
    set({ settings })
  }
}))

/** Convierte una ruta de disco en una URL que el renderer puede mostrar. */
export function imageUrl(absPath: string): string {
  return `geni-file://img/?path=${encodeURIComponent(absPath)}`
}
