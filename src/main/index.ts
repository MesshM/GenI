import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { existsSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { closeDatabase, openDatabase } from './db'
import { messagesRepo } from './db/repositories'
import { registerIpc } from './ipc'
import { comfyProcess } from './comfy/process'
import { comfyClient } from './comfy/client'
import { compressConversation, resolveFromZip } from './conversations/archive'
import { getLastActiveConversation, getSettings } from './settings'
import { presetsImagesRoot } from './presets/manager'
import { updater } from './updater'

const IMAGE_SCHEME = 'geni-file'

// El esquema tiene que declararse antes de que la app este lista.
protocol.registerSchemesAsPrivileged([
  { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    title: 'GenI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // El renderer no ve Node ni el modulo electron. Solo la superficie
      // acotada que expone el preload por contextBridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Nada de ventanas nuevas: los enlaces externos van al navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Y la ventana no navega fuera de la propia app.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devServer = process.env.ELECTRON_RENDERER_URL
    if (devServer && url.startsWith(devServer)) return
    event.preventDefault()
  })

  const devServer = process.env.ELECTRON_RENDERER_URL
  if (devServer) {
    void mainWindow.loadURL(devServer)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

/**
 * Sirve imagenes al renderer: las generadas por ComfyUI y las de referencia
 * de los presets, que viven en carpetas distintas.
 *
 * Solo entrega archivos dentro de esas dos raices: asi la interfaz no puede
 * pedir un archivo arbitrario del disco aunque le pasen una ruta manipulada
 * con "..".
 *
 * Si el archivo no esta en disco (la conversacion esta comprimida) se
 * intenta servir la misma imagen desde su .zip — asi las miniaturas de
 * conversaciones inactivas siguen mostrandose sin tener que descomprimir
 * todo el historial solo para pintar el sidebar.
 */
function registerImageProtocol(): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const url = new URL(request.url)
    const requested = decodeURIComponent(url.searchParams.get('path') ?? '')
    if (!requested) return new Response('Falta el parametro path', { status: 400 })

    const roots = [resolve(join(getSettings().comfyPath, 'output')), resolve(presetsImagesRoot())]
    const target = resolve(normalize(requested))

    const allowed = roots.some((root) => target === root || target.startsWith(root + sep))
    if (!allowed) {
      return new Response('Ruta fuera de la carpeta permitida', { status: 403 })
    }

    if (existsSync(target)) {
      return net.fetch(pathToFileURL(target).toString())
    }

    const fromZip = resolveFromZip(target)
    if (fromZip) {
      const mime = MIME_BY_EXT[extname(target).toLowerCase()] ?? 'application/octet-stream'
      return new Response(fromZip, { headers: { 'Content-Type': mime } })
    }

    return new Response('No encontrado', { status: 404 })
  })
}

// Una sola instancia: dos ventanas contra la misma base SQLite es pedir problemas.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    openDatabase()
    // Si la app se cerro de golpe, los trabajos a medias quedaron colgados.
    messagesRepo.failStale()

    registerImageProtocol()
    registerIpc(() => mainWindow)
    createWindow()

    const settings = getSettings()
    if (settings.autoStartComfy && settings.comfyPath) {
      void comfyProcess.start()
    }

    // Se consulta con retraso para no competir con el arranque de ComfyUI,
    // que es lo que el usuario esta esperando de verdad.
    setTimeout(() => void updater.check(), 15_000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  // Comprimir es async, pero 'before-quit' no espera promesas: se frena la
  // primera vez, se hace el trabajo, y se vuelve a pedir el quit ya listo
  // para salir de verdad (con la bandera evitando el segundo intento).
  let readyToQuit = false
  app.on('before-quit', (event) => {
    if (readyToQuit) return
    event.preventDefault()

    void (async () => {
      const lastActive = getLastActiveConversation()
      if (lastActive) await compressConversation(lastActive).catch(() => undefined)

      comfyClient.disconnect()
      comfyProcess.stop()
      closeDatabase()

      readyToQuit = true
      app.quit()
    })()
  })
}
