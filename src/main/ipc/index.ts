import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from 'electron'
import { copyFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import sharp from 'sharp'
import { CH, EV } from '@shared/channels'
import { conversationsRepo, messagesRepo } from '../db/repositories'
import { comfyProcess } from '../comfy/process'
import { comfyClient } from '../comfy/client'
import { generator } from '../comfy/generator'
import {
  comfyInstaller,
  defaultInstallDir,
  detectGpuVendor,
  detectPython
} from '../comfy/installer'
import { inspectWorkflowFile } from '../comfy/workflow-import'
import { translateEsToEn } from '../translate/translate'
import { listRecipes } from '../comfy/recipes'
import {
  deleteModel,
  importModelFile,
  listModels,
  scanModels,
  updateModel
} from '../models/manager'
import { downloader } from '../models/download'
import { createPreset, deletePreset, isImageFile, listPresets } from '../presets/manager'
import {
  addToCollection,
  collectionsForGeneration,
  createCollection,
  deleteCollection,
  getCollection,
  listCollectionItems,
  listCollections,
  removeFromCollection,
  updateCollection
} from '../collections/manager'
import {
  compressConversation,
  decompressConversation,
  deleteConversationFiles
} from '../conversations/archive'
import {
  detectComfy,
  getSettings,
  isComfyFolder,
  setLastActiveConversation,
  updateSettings
} from '../settings'
import { updater } from '../updater'
import type { AppSettings, CreatePresetInput, ImportResult, SubmitInput } from '@shared/types'

// ------------------------------------------------------- validacion basica
// Todo lo que llega del renderer se trata como no confiable, aunque sea
// nuestra propia interfaz: un bug de UI no deberia poder corromper la base.

function asString(v: unknown, field: string, max = 20_000): string {
  if (typeof v !== 'string') throw new Error(`"${field}" tiene que ser texto`)
  if (v.length > max) throw new Error(`"${field}" es demasiado largo`)
  return v
}

function asId(v: unknown, field: string): string {
  const s = asString(v, field, 200)
  if (!s.trim()) throw new Error(`"${field}" no puede estar vacio`)
  return s
}

function asSubmitInput(v: unknown): SubmitInput {
  if (typeof v !== 'object' || v === null) throw new Error('Peticion invalida')
  const o = v as Record<string, unknown>

  const params = o.params as Record<string, unknown>
  if (typeof params !== 'object' || params === null) throw new Error('Faltan los parametros')

  const num = (key: string, min: number, max: number, fallback: number): number => {
    const n = Number(params[key])
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  }

  return {
    conversationId: asId(o.conversationId, 'conversationId'),
    presetId: asId(o.presetId, 'presetId'),
    prompt: asString(o.prompt ?? '', 'prompt'),
    negative: asString(o.negative ?? '', 'negative'),
    inputImagePath:
      typeof o.inputImagePath === 'string' ? o.inputImagePath : undefined,
    params: {
      width: num('width', 64, 4096, 1024),
      height: num('height', 64, 4096, 1024),
      steps: num('steps', 1, 150, 20),
      cfg: num('cfg', 0, 30, 5),
      seed: num('seed', 0, 2 ** 32 - 1, 0),
      batchSize: num('batchSize', 1, 8, 1),
      denoise: params.denoise === undefined ? undefined : num('denoise', 0, 1, 0.45),
      samplerName: asString(params.samplerName ?? 'euler', 'samplerName', 64),
      scheduler: asString(params.scheduler ?? 'normal', 'scheduler', 64),
      randomSeed: Boolean(params.randomSeed),
      hiresSteps:
        params.hiresSteps === undefined ? undefined : num('hiresSteps', 1, 80, 16),
      loras: Array.isArray(params.loras)
        ? params.loras.slice(0, 10).map((l) => {
            const lo = l as Record<string, unknown>
            const strength = Number(lo.strength)
            return {
              modelId: asString(lo.modelId ?? '', 'lora.modelId', 200),
              filename: asString(lo.filename ?? '', 'lora.filename', 400),
              label: asString(lo.label ?? '', 'lora.label', 200),
              strength: Number.isFinite(strength) ? Math.min(2, Math.max(0, strength)) : 0,
              enabled: Boolean(lo.enabled),
              triggers: Array.isArray(lo.triggers)
                ? lo.triggers.map((w) => asString(w, 'lora.trigger', 100)).filter(Boolean).slice(0, 12)
                : []
            }
          })
        : []
    }
  }
}

function asGenerationParams(v: unknown): SubmitInput['params'] {
  // Reutiliza el mismo parser que ya valida los parametros de generacion,
  // envolviendolo en la forma que espera asSubmitInput.
  return asSubmitInput({ conversationId: 'x', presetId: 'x', prompt: '', negative: '', params: v })
    .params
}

function asCreatePresetInput(v: unknown): CreatePresetInput {
  if (typeof v !== 'object' || v === null) throw new Error('Preset invalido')
  const o = v as Record<string, unknown>
  return {
    name: asString(o.name, 'name', 200).trim() || 'Preset sin nombre',
    recipeId: asId(o.recipeId, 'recipeId'),
    recipeName: asString(o.recipeName ?? '', 'recipeName', 200),
    negative: asString(o.negative ?? '', 'negative'),
    params: asGenerationParams(o.params),
    referenceImageSourcePath:
      typeof o.referenceImageSourcePath === 'string' ? o.referenceImageSourcePath : undefined
  }
}

// ------------------------------------------------------------- registro

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  // --- ajustes
  ipcMain.handle(CH.settingsGet, () => getSettings())

  ipcMain.handle(CH.settingsUpdate, (_e, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) throw new Error('Ajustes invalidos')
    const p = patch as Partial<AppSettings>

    if (p.comfyPath !== undefined && p.comfyPath !== '' && !isComfyFolder(p.comfyPath)) {
      throw new Error('Esa carpeta no contiene main.py, no parece ser ComfyUI')
    }
    if (p.comfyPort !== undefined) {
      const port = Number(p.comfyPort)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Puerto invalido')
      }
    }
    return updateSettings(p)
  })

  ipcMain.handle(CH.settingsDetectComfy, () => detectComfy())

  ipcMain.handle(CH.settingsPickComfyFolder, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Elegi la carpeta de ComfyUI',
      properties: ['openDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(CH.settingsPickInstallFolder, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Elige donde instalar ComfyUI',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  // --- workflows de ComfyUI (.json exportado)
  ipcMain.handle(CH.workflowPick, async () => {
    const win = getWindow()
    if (!win) return null

    const picked = await dialog.showOpenDialog(win, {
      title: 'Elige un workflow de ComfyUI',
      properties: ['openFile'],
      filters: [{ name: 'Workflow de ComfyUI', extensions: ['json'] }]
    })
    if (picked.canceled || !picked.filePaths[0]) return null

    return inspectWorkflowFile(picked.filePaths[0])
  })

  // --- instalacion de ComfyUI desde cero
  ipcMain.handle(CH.installDetectEnv, async () => {
    const [gpu, python, suggestedDir] = await Promise.all([
      detectGpuVendor(),
      detectPython(),
      defaultInstallDir(app.getPath('home'))
    ])
    return { gpu, python, suggestedDir }
  })

  ipcMain.handle(CH.installComfy, async (_e, targetDir: unknown) => {
    const dir = asString(targetDir, 'targetDir', 1000)
    const [gpu, python] = await Promise.all([detectGpuVendor(), detectPython()])
    if (!python) {
      throw new Error(
        'No encontre Python en el sistema. Instalalo desde python.org (3.10 o mas nuevo) y volve a intentar.'
      )
    }
    const installed = await comfyInstaller.install(dir, python, gpu)
    updateSettings({ comfyPath: installed })
    return installed
  })

  comfyInstaller.on('progress', (p) => send(EV.installProgress, p))
  comfyInstaller.on('log', (line: string) =>
    send(EV.installProgress, {
      step: '',
      log: line,
      percent: -1,
      done: false,
      error: null
    })
  )

  // --- proceso ComfyUI
  ipcMain.handle(CH.comfyStatus, () => comfyProcess.getStatus())
  ipcMain.handle(CH.comfyStart, () => comfyProcess.start())
  ipcMain.handle(CH.comfyStop, () => comfyProcess.stop())

  comfyProcess.on('status', (status) => {
    if (status.state === 'ready') comfyClient.connect()
    send(EV.comfyStatus, status)
  })

  // --- recetas (derivadas del catalogo de modelos)
  ipcMain.handle(CH.recipesList, () => listRecipes())

  // --- presets (configuraciones guardadas, con imagen de referencia)
  ipcMain.handle(CH.presetsList, () => listPresets())

  ipcMain.handle(CH.presetsCreate, async (_e, input: unknown) =>
    createPreset(asCreatePresetInput(input))
  )

  ipcMain.handle(CH.presetsRemove, (_e, id: unknown) => deletePreset(asId(id, 'id')))

  ipcMain.handle(CH.presetsPickReferenceImage, async () => {
    const win = getWindow()
    if (!win) return null

    const picked = await dialog.showOpenDialog(win, {
      title: 'Elegi una imagen de referencia',
      properties: ['openFile'],
      filters: [{ name: 'Imagenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    if (picked.canceled || !picked.filePaths[0]) return null

    const path = picked.filePaths[0]
    if (!(await isImageFile(path))) throw new Error('Ese archivo no parece una imagen valida')
    return path
  })

  // --- modelos
  ipcMain.handle(CH.modelsList, () => listModels())
  ipcMain.handle(CH.modelsScan, () => scanModels())

  ipcMain.handle(CH.modelsImportPaths, async (_e, paths: unknown) => {
    if (!Array.isArray(paths)) throw new Error('Se esperaba una lista de rutas')
    const results: ImportResult[] = []
    for (const p of paths.slice(0, 20)) {
      results.push(await importModelFile(asString(p, 'ruta', 1000)))
    }
    return results
  })

  ipcMain.handle(CH.modelsPickAndImport, async () => {
    const win = getWindow()
    if (!win) return []

    const picked = await dialog.showOpenDialog(win, {
      title: 'Elegi los modelos a importar',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Modelos', extensions: ['safetensors', 'ckpt', 'pt', 'pth', 'gguf', 'sft'] }]
    })
    if (picked.canceled) return []

    const results: ImportResult[] = []
    for (const p of picked.filePaths) results.push(await importModelFile(p))
    return results
  })

  ipcMain.handle(CH.modelsRemove, (_e, id: unknown) => deleteModel(asId(id, 'id')))

  ipcMain.handle(CH.modelsUpdate, (_e, id: unknown, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) throw new Error('Cambios invalidos')
    const p = patch as { triggerWords?: unknown; notes?: unknown }
    return updateModel(asId(id, 'id'), {
      triggerWords: Array.isArray(p.triggerWords)
        ? p.triggerWords.map((w) => asString(w, 'trigger', 100)).filter(Boolean).slice(0, 12)
        : undefined,
      notes: p.notes === undefined ? undefined : asString(p.notes, 'notes', 2000)
    })
  })

  ipcMain.handle(CH.modelsDownload, (_e, url: unknown) =>
    downloader.start(asString(url, 'url', 2000))
  )
  ipcMain.handle(CH.modelsCancelDownload, (_e, id: unknown) => downloader.cancel(asId(id, 'id')))
  ipcMain.handle(CH.modelsDownloads, () => downloader.list())

  downloader.on('job', (job) => send(EV.modelDownload, job))

  // --- conversaciones
  ipcMain.handle(CH.convList, () => conversationsRepo.list())
  ipcMain.handle(CH.convCreate, (_e, presetId: unknown) =>
    conversationsRepo.create(asId(presetId, 'presetId'))
  )
  ipcMain.handle(CH.convRename, (_e, id: unknown, title: unknown) =>
    conversationsRepo.rename(asId(id, 'id'), asString(title, 'title', 300))
  )
  ipcMain.handle(CH.convRemove, async (_e, id: unknown) => {
    const convId = asId(id, 'id')
    conversationsRepo.remove(convId)
    // Best-effort: si falla no hay que romper el borrado, ya se fue de la base.
    await deleteConversationFiles(convId).catch(() => undefined)
  })
  ipcMain.handle(CH.convMessages, (_e, id: unknown) =>
    messagesRepo.byConversation(asId(id, 'id'))
  )

  ipcMain.handle(CH.convDecompress, (_e, id: unknown) => decompressConversation(asId(id, 'id')))
  ipcMain.handle(CH.convCompress, (_e, id: unknown) => compressConversation(asId(id, 'id')))
  ipcMain.handle(CH.convSetActive, (_e, id: unknown) => {
    setLastActiveConversation(asId(id, 'id'))
  })

  // --- colecciones
  ipcMain.handle(CH.collList, () => listCollections())
  ipcMain.handle(CH.collCreate, (_e, input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>
    return createCollection({
      name: asString(raw.name, 'name', 200),
      description: raw.description === undefined ? '' : asString(raw.description, 'description', 2000),
      fromMessageId: raw.fromMessageId ? asId(raw.fromMessageId, 'fromMessageId') : undefined,
      promptTemplate:
        raw.promptTemplate === undefined ? '' : asString(raw.promptTemplate, 'promptTemplate', 4000),
      negativeTemplate:
        raw.negativeTemplate === undefined
          ? ''
          : asString(raw.negativeTemplate, 'negativeTemplate', 4000),
      presetId: raw.presetId ? asId(raw.presetId, 'presetId') : null,
      lockedSeed: typeof raw.lockedSeed === 'number' ? raw.lockedSeed : null
    })
  })
  ipcMain.handle(CH.collUpdate, (_e, id: unknown, patch: unknown) => {
    const raw = (patch ?? {}) as Record<string, unknown>
    return updateCollection(asId(id, 'id'), {
      name: raw.name === undefined ? undefined : asString(raw.name, 'name', 200),
      description:
        raw.description === undefined ? undefined : asString(raw.description, 'description', 2000),
      promptTemplate:
        raw.promptTemplate === undefined
          ? undefined
          : asString(raw.promptTemplate, 'promptTemplate', 4000),
      negativeTemplate:
        raw.negativeTemplate === undefined
          ? undefined
          : asString(raw.negativeTemplate, 'negativeTemplate', 4000),
      presetId: raw.presetId === undefined ? undefined : raw.presetId ? asId(raw.presetId, 'presetId') : null,
      lockedSeed:
        raw.lockedSeed === undefined ? undefined : typeof raw.lockedSeed === 'number' ? raw.lockedSeed : null
    })
  })
  ipcMain.handle(CH.collRemove, (_e, id: unknown) => deleteCollection(asId(id, 'id')))
  ipcMain.handle(CH.collItems, (_e, id: unknown) => listCollectionItems(asId(id, 'id')))
  ipcMain.handle(CH.collAdd, (_e, collectionId: unknown, generationIds: unknown) => {
    const ids = Array.isArray(generationIds) ? generationIds : []
    addToCollection(
      asId(collectionId, 'collectionId'),
      ids.slice(0, 200).map((g) => asId(g, 'generationId'))
    )
  })
  ipcMain.handle(CH.collRemoveItem, (_e, collectionId: unknown, generationId: unknown) =>
    removeFromCollection(asId(collectionId, 'collectionId'), asId(generationId, 'generationId'))
  )
  ipcMain.handle(CH.collForGeneration, (_e, generationId: unknown) =>
    collectionsForGeneration(asId(generationId, 'generationId'))
  )
  ipcMain.handle(CH.collStartConversation, (_e, collectionId: unknown) => {
    const collection = getCollection(asId(collectionId, 'collectionId'))
    if (!collection) throw new Error('Esa coleccion ya no existe')

    // La conversacion nace apuntando a la receta de la coleccion; si esa
    // receta ya no esta (se borro el modelo), cae en la primera disponible
    // para que igual se pueda abrir en vez de fallar.
    const recipes = listRecipes()
    const recipeId =
      (collection.recipeId && recipes.find((r) => r.id === collection.recipeId)?.id) ??
      recipes[0]?.id
    if (!recipeId) throw new Error('No hay ningun modelo instalado')

    const conversation = conversationsRepo.create(recipeId)
    conversationsRepo.rename(conversation.id, collection.name)
    return { ...conversation, title: collection.name }
  })

  // --- generacion
  ipcMain.handle(CH.genSubmit, (_e, input: unknown) => generator.submit(asSubmitInput(input)))
  ipcMain.handle(CH.genCancel, (_e, messageId: unknown) =>
    generator.cancel(asId(messageId, 'messageId'))
  )

  generator.on('progress', (p) => send(EV.genProgress, p))
  generator.on('message', (m) => send(EV.genMessage, m))

  // --- imagenes
  ipcMain.handle(CH.imgReveal, (_e, absPath: unknown) => {
    shell.showItemInFolder(asString(absPath, 'absPath', 1000))
  })

  ipcMain.handle(CH.imgCopy, async (_e, absPath: unknown) => {
    const source = asString(absPath, 'absPath', 1000)
    // nativeImage solo decodifica PNG/JPEG (verificado contra la docs de
    // Electron); el output vive en WEBP, asi que se reconvierte con sharp
    // solo para este viaje al portapapeles.
    const pngBuffer = await sharp(source).png().toBuffer()
    const image = nativeImage.createFromBuffer(pngBuffer)
    if (image.isEmpty()) throw new Error('No se pudo leer la imagen')
    clipboard.writeImage(image)
  })

  ipcMain.handle(CH.imgSaveAs, async (_e, absPath: unknown) => {
    const source = asString(absPath, 'absPath', 1000)
    const win = getWindow()
    if (!win) return null

    // En disco se guarda WEBP (ocupa mucho menos), pero al exportar se
    // ofrece PNG por defecto: es el formato que espera cualquier editor.
    // Se elige por la extension del archivo destino, asi el usuario puede
    // pedir WEBP desde el mismo dialogo si quiere conservar el original.
    const result = await dialog.showSaveDialog(win, {
      title: 'Guardar imagen',
      defaultPath: basename(source).replace(/\.webp$/i, '.png'),
      filters: [
        { name: 'Imagen PNG', extensions: ['png'] },
        { name: 'Imagen JPEG', extensions: ['jpg'] },
        { name: 'Imagen WEBP', extensions: ['webp'] }
      ]
    })
    if (result.canceled || !result.filePath) return null

    const target = result.filePath
    const targetExt = extname(target).toLowerCase()
    const sourceExt = extname(source).toLowerCase()

    if (targetExt === sourceExt) {
      await copyFile(source, target)
    } else if (targetExt === '.jpg' || targetExt === '.jpeg') {
      await sharp(source).jpeg({ quality: 95 }).toFile(target)
    } else if (targetExt === '.webp') {
      await sharp(source).webp({ quality: 95 }).toFile(target)
    } else {
      await sharp(source).png().toFile(target)
    }

    return target
  })

  // --- actualizaciones
  ipcMain.handle(CH.updCheck, () => updater.check())
  ipcMain.handle(CH.updDownload, () => updater.download())
  ipcMain.handle(CH.updInstall, () => updater.install())
  updater.on('state', (state) => send(EV.updState, state))

  // --- app
  ipcMain.handle(CH.appVersion, () => app.getVersion())

  // --- ventana (sin marco nativo, la TopBar dibuja sus propios controles)
  ipcMain.handle(CH.windowMinimize, () => getWindow()?.minimize())
  ipcMain.handle(CH.windowToggleMaximize, () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle(CH.windowClose, () => getWindow()?.close())
  ipcMain.handle(CH.windowIsMaximized, () => getWindow()?.isMaximized() ?? false)

  // --- traduccion
  ipcMain.handle(CH.translateEsToEn, (_e, text: unknown) =>
    translateEsToEn(asString(text, 'text', 4000))
  )
}
