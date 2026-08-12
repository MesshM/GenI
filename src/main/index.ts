import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { closeDatabase, openDatabase } from './db'
import { messagesRepo } from './db/repositories'
import { registerIpc } from './ipc'
import { comfyProcess } from './comfy/process'
import { comfyClient } from './comfy/client'
import { getSettings } from './settings'
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

/**
 * Sirve las imagenes generadas al renderer.
 *
 * Solo entrega archivos que esten dentro de la carpeta output de ComfyUI: asi
 * la interfaz no puede pedir un archivo arbitrario del disco aunque le pasen
 * una ruta manipulada con "..".
 */
function registerImageProtocol(): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const url = new URL(request.url)
    const requested = decodeURIComponent(url.searchParams.get('path') ?? '')
    if (!requested) return new Response('Falta el parametro path', { status: 400 })

    const root = resolve(join(getSettings().comfyPath, 'output'))
    const target = resolve(normalize(requested))

    if (target !== root && !target.startsWith(root + sep)) {
      return new Response('Ruta fuera de la carpeta permitida', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
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

  app.on('before-quit', () => {
    comfyClient.disconnect()
    comfyProcess.stop()
    closeDatabase()
  })
}
