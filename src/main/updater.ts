import { EventEmitter } from 'node:events'
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateInfo } from '@shared/types'

const { autoUpdater } = electronUpdater

/**
 * Actualizaciones desde GitHub Releases.
 *
 * Los datos del usuario (base SQLite y ajustes) viven en userData, que esta
 * fuera del directorio del programa. El instalador reemplaza los binarios y no
 * toca esa carpeta, asi que actualizar nunca borra conversaciones ni ajustes.
 * Los cambios de esquema los resuelven las migraciones al abrir.
 */
class Updater extends EventEmitter {
  private state: UpdateInfo = {
    available: false,
    version: null,
    downloading: false,
    downloaded: false,
    percent: 0,
    error: null
  }

  constructor() {
    super()
    // Nunca descargar ni instalar sin que el usuario lo pida.
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('update-available', (info) => {
      this.patch({ available: true, version: info.version, error: null })
    })
    autoUpdater.on('update-not-available', () => {
      this.patch({ available: false, version: null })
    })
    autoUpdater.on('download-progress', (p) => {
      this.patch({ downloading: true, percent: Math.round(p.percent) })
    })
    autoUpdater.on('update-downloaded', () => {
      this.patch({ downloading: false, downloaded: true, percent: 100 })
    })
    autoUpdater.on('error', (err) => {
      this.patch({ downloading: false, error: err.message })
    })
  }

  private patch(patch: Partial<UpdateInfo>): void {
    this.state = { ...this.state, ...patch }
    this.emit('state', this.state)
  }

  getState(): UpdateInfo {
    return this.state
  }

  async check(): Promise<UpdateInfo> {
    // En desarrollo no hay instalador contra el que comparar.
    if (!app.isPackaged) return this.state
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.patch({ error: err instanceof Error ? err.message : String(err) })
    }
    return this.state
  }

  async download(): Promise<void> {
    if (!this.state.available) return
    this.patch({ downloading: true, percent: 0, error: null })
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      this.patch({ downloading: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  install(): void {
    if (!this.state.downloaded) return
    autoUpdater.quitAndInstall()
  }
}

export const updater = new Updater()
