import { create } from 'zustand'
import type {
  AppSettings,
  ComfyStatus,
  Conversation,
  DownloadJob,
  GenerationParams,
  GenerationProgress,
  LoraSetting,
  Message,
  ModelAsset,
  Recipe,
  UpdateInfo
} from '@shared/types'

export type View = 'chat' | 'models'

interface State {
  ready: boolean
  view: View
  settings: AppSettings | null
  comfy: ComfyStatus
  update: UpdateInfo | null

  recipes: Recipe[]
  models: ModelAsset[]
  downloads: DownloadJob[]

  conversations: Conversation[]
  activeId: string | null
  messages: Message[]
  progress: Record<string, GenerationProgress>

  prompt: string
  negative: string
  params: GenerationParams | null
  recipeId: string | null

  setView: (v: View) => void
  bootstrap: () => Promise<void>
  refreshModels: () => Promise<void>

  selectConversation: (id: string) => Promise<void>
  newConversation: (recipeId?: string) => Promise<void>
  removeConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>

  chooseRecipe: (recipeId: string) => void
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

  conversations: [],
  activeId: null,
  messages: [],
  progress: {},

  prompt: '',
  negative: '',
  params: null,
  recipeId: null,

  setView: (view) => set({ view }),

  async bootstrap() {
    const settings = await window.geni.settings.get()

    // Sin ruta de ComfyUI no hay carpetas que escanear todavia.
    if (settings.comfyPath) await window.geni.models.scan()

    const [recipes, models, conversations, comfy, downloads] = await Promise.all([
      window.geni.recipes.list(),
      window.geni.models.list(),
      window.geni.conversations.list(),
      window.geni.comfy.status(),
      window.geni.models.downloads()
    ])

    const first = recipes[0] ?? null
    set({
      settings,
      recipes,
      models,
      conversations,
      comfy,
      downloads,
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
    set({ settings })
  }
}))

/** Convierte una ruta de disco en una URL que el renderer puede mostrar. */
export function imageUrl(absPath: string): string {
  return `geni-file://img/?path=${encodeURIComponent(absPath)}`
}
