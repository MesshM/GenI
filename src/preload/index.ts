import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { CH, EV } from '@shared/channels'
import type {
  AppSettings,
  ComfyStatus,
  Conversation,
  CreatePresetInput,
  DownloadJob,
  GenIApi,
  GenerationProgress,
  ImportResult,
  Message,
  ModelAsset,
  ParamPreset,
  Recipe,
  SubmitInput,
  UpdateInfo
} from '@shared/types'

/**
 * Suscribe un callback a un evento del proceso principal y devuelve la funcion
 * para darse de baja. Sin esto, cada render de React acumularia listeners.
 */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

/**
 * Superficie completa que ve el renderer. No se expone `ipcRenderer`: la
 * interfaz solo puede llamar a estas funciones, sobre canales concretos.
 */
const api: GenIApi = {
  settings: {
    get: () => ipcRenderer.invoke(CH.settingsGet) as Promise<AppSettings>,
    update: (patch) => ipcRenderer.invoke(CH.settingsUpdate, patch) as Promise<AppSettings>,
    pickComfyFolder: () => ipcRenderer.invoke(CH.settingsPickComfyFolder) as Promise<string | null>,
    detectComfy: () => ipcRenderer.invoke(CH.settingsDetectComfy) as Promise<string | null>
  },
  comfy: {
    status: () => ipcRenderer.invoke(CH.comfyStatus) as Promise<ComfyStatus>,
    start: () => ipcRenderer.invoke(CH.comfyStart) as Promise<ComfyStatus>,
    stop: () => ipcRenderer.invoke(CH.comfyStop) as Promise<void>,
    onStatus: (cb) => subscribe<ComfyStatus>(EV.comfyStatus, cb)
  },
  recipes: {
    list: () => ipcRenderer.invoke(CH.recipesList) as Promise<Recipe[]>
  },
  presets: {
    list: () => ipcRenderer.invoke(CH.presetsList) as Promise<ParamPreset[]>,
    create: (input: CreatePresetInput) =>
      ipcRenderer.invoke(CH.presetsCreate, input) as Promise<ParamPreset>,
    remove: (id) => ipcRenderer.invoke(CH.presetsRemove, id) as Promise<void>,
    pickReferenceImage: () =>
      ipcRenderer.invoke(CH.presetsPickReferenceImage) as Promise<string | null>
  },
  models: {
    list: () => ipcRenderer.invoke(CH.modelsList) as Promise<ModelAsset[]>,
    scan: () =>
      ipcRenderer.invoke(CH.modelsScan) as Promise<{ found: number; removed: number }>,
    importPaths: (paths) =>
      ipcRenderer.invoke(CH.modelsImportPaths, paths) as Promise<ImportResult[]>,
    pathForFile: (file) => webUtils.getPathForFile(file),
    pickAndImport: () => ipcRenderer.invoke(CH.modelsPickAndImport) as Promise<ImportResult[]>,
    remove: (id) => ipcRenderer.invoke(CH.modelsRemove, id) as Promise<void>,
    update: (id, patch) =>
      ipcRenderer.invoke(CH.modelsUpdate, id, patch) as Promise<ModelAsset | null>,
    download: (url) => ipcRenderer.invoke(CH.modelsDownload, url) as Promise<DownloadJob>,
    cancelDownload: (id) => ipcRenderer.invoke(CH.modelsCancelDownload, id) as Promise<void>,
    downloads: () => ipcRenderer.invoke(CH.modelsDownloads) as Promise<DownloadJob[]>,
    onDownload: (cb) => subscribe<DownloadJob>(EV.modelDownload, cb)
  },
  conversations: {
    list: () => ipcRenderer.invoke(CH.convList) as Promise<Conversation[]>,
    create: (presetId) => ipcRenderer.invoke(CH.convCreate, presetId) as Promise<Conversation>,
    rename: (id, title) => ipcRenderer.invoke(CH.convRename, id, title) as Promise<void>,
    remove: (id) => ipcRenderer.invoke(CH.convRemove, id) as Promise<void>,
    messages: (id) => ipcRenderer.invoke(CH.convMessages, id) as Promise<Message[]>,
    decompress: (id) => ipcRenderer.invoke(CH.convDecompress, id) as Promise<void>,
    compress: (id) => ipcRenderer.invoke(CH.convCompress, id) as Promise<void>,
    setActive: (id) => ipcRenderer.invoke(CH.convSetActive, id) as Promise<void>
  },
  generate: {
    submit: (input: SubmitInput) => ipcRenderer.invoke(CH.genSubmit, input) as Promise<Message>,
    cancel: (messageId) => ipcRenderer.invoke(CH.genCancel, messageId) as Promise<void>,
    onProgress: (cb) => subscribe<GenerationProgress>(EV.genProgress, cb),
    onMessageUpdate: (cb) => subscribe<Message>(EV.genMessage, cb)
  },
  images: {
    reveal: (absPath) => ipcRenderer.invoke(CH.imgReveal, absPath) as Promise<void>,
    copy: (absPath) => ipcRenderer.invoke(CH.imgCopy, absPath) as Promise<void>,
    saveAs: (absPath) => ipcRenderer.invoke(CH.imgSaveAs, absPath) as Promise<string | null>
  },
  updates: {
    check: () => ipcRenderer.invoke(CH.updCheck) as Promise<UpdateInfo>,
    download: () => ipcRenderer.invoke(CH.updDownload) as Promise<void>,
    install: () => ipcRenderer.invoke(CH.updInstall) as Promise<void>,
    onState: (cb) => subscribe<UpdateInfo>(EV.updState, cb)
  },
  app: {
    version: () => ipcRenderer.invoke(CH.appVersion) as Promise<string>
  },
  window: {
    minimize: () => ipcRenderer.invoke(CH.windowMinimize) as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke(CH.windowToggleMaximize) as Promise<void>,
    close: () => ipcRenderer.invoke(CH.windowClose) as Promise<void>,
    isMaximized: () => ipcRenderer.invoke(CH.windowIsMaximized) as Promise<boolean>,
    onMaximizedChange: (cb) => subscribe<boolean>(EV.windowMaximized, cb)
  },
  translate: {
    esToEn: (text) => ipcRenderer.invoke(CH.translateEsToEn, text) as Promise<string>
  }
}

contextBridge.exposeInMainWorld('geni', api)
