// Lista blanca de canales IPC. El preload solo reenvia estos nombres;
// cualquier otro queda rechazado antes de llegar al proceso principal.

export const CH = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsPickComfyFolder: 'settings:pickComfyFolder',
  settingsDetectComfy: 'settings:detectComfy',
  settingsPickInstallFolder: 'settings:pickInstallFolder',

  installDetectEnv: 'install:detectEnv',
  installComfy: 'install:comfy',

  workflowPick: 'workflow:pick',
  workflowInspectText: 'workflow:inspectText',

  comfyStatus: 'comfy:status',
  comfyStart: 'comfy:start',
  comfyStop: 'comfy:stop',

  recipesList: 'recipes:list',

  presetsList: 'presets:list',
  presetsCreate: 'presets:create',
  presetsRemove: 'presets:remove',
  presetsPickReferenceImage: 'presets:pickReferenceImage',

  modelsList: 'models:list',
  modelsScan: 'models:scan',
  modelsImportPaths: 'models:importPaths',
  modelsPickAndImport: 'models:pickAndImport',
  modelsRemove: 'models:remove',
  modelsUpdate: 'models:update',
  modelsDownload: 'models:download',
  modelsCancelDownload: 'models:cancelDownload',
  modelsDownloads: 'models:downloads',

  convList: 'conv:list',
  convCreate: 'conv:create',
  convRename: 'conv:rename',
  convRemove: 'conv:remove',
  convMessages: 'conv:messages',
  convDecompress: 'conv:decompress',
  convCompress: 'conv:compress',
  convSetActive: 'conv:setActive',

  collList: 'coll:list',
  collCreate: 'coll:create',
  collUpdate: 'coll:update',
  collRemove: 'coll:remove',
  collItems: 'coll:items',
  collAdd: 'coll:add',
  collRemoveItem: 'coll:removeItem',
  collForGeneration: 'coll:forGeneration',
  collStartConversation: 'coll:startConversation',

  genSubmit: 'gen:submit',
  genCancel: 'gen:cancel',

  imgReveal: 'img:reveal',
  imgCopy: 'img:copy',
  imgSaveAs: 'img:saveAs',

  updCheck: 'upd:check',
  updDownload: 'upd:download',
  updInstall: 'upd:install',

  appVersion: 'app:version',

  translateEsToEn: 'translate:esToEn',

  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggleMaximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:isMaximized'
} as const

/** Eventos que empuja el proceso principal hacia la interfaz. */
export const EV = {
  comfyStatus: 'ev:comfyStatus',
  genProgress: 'ev:genProgress',
  genMessage: 'ev:genMessage',
  updState: 'ev:updState',
  modelDownload: 'ev:modelDownload',
  installProgress: 'ev:installProgress',
  windowMaximized: 'ev:windowMaximized'
} as const

export type InvokeChannel = (typeof CH)[keyof typeof CH]
export type EventChannel = (typeof EV)[keyof typeof EV]

export const INVOKE_CHANNELS: readonly string[] = Object.values(CH)
export const EVENT_CHANNELS: readonly string[] = Object.values(EV)
