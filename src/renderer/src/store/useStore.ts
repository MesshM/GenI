import { create } from 'zustand'
import type {
  AppSettings,
  ComfyStatus,
  Conversation,
  GenerationParams,
  GenerationProgress,
  Message,
  Preset,
  UpdateInfo
} from '@shared/types'

interface State {
  ready: boolean
  settings: AppSettings | null
  comfy: ComfyStatus
  update: UpdateInfo | null

  presets: Preset[]
  conversations: Conversation[]
  activeId: string | null
  messages: Message[]

  /** Progreso en vivo, indexado por id de mensaje. */
  progress: Record<string, GenerationProgress>

  prompt: string
  negative: string
  params: GenerationParams | null
  presetId: string | null

  bootstrap: () => Promise<void>
  selectConversation: (id: string) => Promise<void>
  newConversation: (presetId?: string) => Promise<void>
  removeConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>

  choosePreset: (presetId: string) => void
  setPrompt: (v: string) => void
  setNegative: (v: string) => void
  patchParams: (patch: Partial<GenerationParams>) => void
  loadParamsFrom: (message: Message) => void

  send: () => Promise<void>
  cancel: (messageId: string) => Promise<void>
  refreshSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  settings: null,
  comfy: { state: 'stopped' },
  update: null,

  presets: [],
  conversations: [],
  activeId: null,
  messages: [],
  progress: {},

  prompt: '',
  negative: '',
  params: null,
  presetId: null,

  async bootstrap() {
    const [settings, presets, conversations, comfy] = await Promise.all([
      window.geni.settings.get(),
      window.geni.presets.list(),
      window.geni.conversations.list(),
      window.geni.comfy.status()
    ])

    const presetId = presets[0]?.id ?? null
    set({
      settings,
      presets,
      conversations,
      comfy,
      presetId,
      params: presets[0] ? structuredClone(presets[0].defaults) : null,
      negative: '',
      ready: true
    })

    // Eventos que empuja el proceso principal.
    window.geni.comfy.onStatus((s) => set({ comfy: s }))
    window.geni.updates.onState((u) => set({ update: u }))

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

        // Cuando termina, el progreso ya no aplica.
        const progress = { ...state.progress }
        if (m.status !== 'running' && m.status !== 'pending') delete progress[m.id]

        return { messages, progress }
      })
      void window.geni.conversations.list().then((conversations) => set({ conversations }))
    })

    if (conversations[0]) await get().selectConversation(conversations[0].id)
  },

  async selectConversation(id) {
    const messages = await window.geni.conversations.messages(id)
    const conversation = get().conversations.find((c) => c.id === id)
    const preset = get().presets.find((p) => p.id === conversation?.presetId)

    set({
      activeId: id,
      messages,
      presetId: conversation?.presetId ?? get().presetId,
      params: preset ? structuredClone(preset.defaults) : get().params
    })
  },

  async newConversation(presetId) {
    const id = presetId ?? get().presetId ?? get().presets[0]?.id
    if (!id) return

    const conversation = await window.geni.conversations.create(id)
    const preset = get().presets.find((p) => p.id === id)

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeId: conversation.id,
      messages: [],
      presetId: id,
      params: preset ? structuredClone(preset.defaults) : state.params,
      prompt: ''
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

  choosePreset(presetId) {
    const preset = get().presets.find((p) => p.id === presetId)
    if (!preset) return
    set({ presetId, params: structuredClone(preset.defaults) })
  },

  setPrompt: (v) => set({ prompt: v }),
  setNegative: (v) => set({ negative: v }),

  patchParams(patch) {
    set((state) => (state.params ? { params: { ...state.params, ...patch } } : {}))
  },

  loadParamsFrom(message) {
    set({
      params: structuredClone(message.params),
      prompt: message.prompt,
      negative: message.negative,
      presetId: message.presetId
    })
  },

  async send() {
    const { activeId, presetId, params, prompt, negative } = get()
    if (!presetId || !params || !prompt.trim()) return

    let conversationId = activeId
    if (!conversationId) {
      await get().newConversation(presetId)
      conversationId = get().activeId
    }
    if (!conversationId) return

    const message = await window.geni.generate.submit({
      conversationId,
      presetId,
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
