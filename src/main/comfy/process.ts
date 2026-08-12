import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { comfyBaseUrl, getSettings, isComfyFolder } from '../settings'
import type { ComfyStatus } from '@shared/types'

const MAX_LOG_LINES = 200
const READY_TIMEOUT_MS = 180_000
const POLL_INTERVAL_MS = 1000

/**
 * Arranca, vigila y apaga el proceso de ComfyUI.
 *
 * Si ya hay una instancia corriendo (por ejemplo el usuario la abrio con su
 * .bat) se conecta a esa en vez de levantar una segunda: dos procesos peleando
 * por la misma GPU y el mismo puerto terminan mal.
 */
class ComfyProcessManager extends EventEmitter {
  private child: ChildProcess | null = null
  private log: string[] = []
  private status: ComfyStatus = { state: 'stopped' }
  /** true cuando el proceso lo lanzo otra persona: entonces no lo matamos. */
  private external = false

  getStatus(): ComfyStatus {
    return this.status
  }

  private setStatus(next: ComfyStatus): void {
    this.status = next
    this.emit('status', next)
  }

  private pushLog(chunk: string): void {
    for (const line of chunk.split(/\r?\n/)) {
      if (!line.trim()) continue
      this.log.push(line)
    }
    if (this.log.length > MAX_LOG_LINES) {
      this.log = this.log.slice(-MAX_LOG_LINES)
    }
    if (this.status.state === 'starting') {
      this.setStatus({ state: 'starting', log: [...this.log] })
    }
  }

  /** Consulta /system_stats. Sirve tanto para detectar como para esperar el arranque. */
  private async probe(): Promise<{ device: string; vramTotalMb: number } | null> {
    try {
      const res = await fetch(`${comfyBaseUrl()}/system_stats`, {
        signal: AbortSignal.timeout(3000)
      })
      if (!res.ok) return null
      const data = (await res.json()) as {
        devices?: { name?: string; vram_total?: number }[]
      }
      const dev = data.devices?.[0]
      return {
        device: dev?.name ?? 'desconocido',
        vramTotalMb: Math.round((dev?.vram_total ?? 0) / 1048576)
      }
    } catch {
      return null
    }
  }

  async start(): Promise<ComfyStatus> {
    if (this.status.state === 'ready') return this.status

    // Alguien ya lo tiene abierto: nos colgamos de esa instancia.
    const existing = await this.probe()
    if (existing) {
      this.external = true
      this.setStatus({ state: 'ready', ...existing })
      return this.status
    }

    const settings = getSettings()
    if (!isComfyFolder(settings.comfyPath)) {
      const status: ComfyStatus = {
        state: 'error',
        message: `No encuentro main.py en "${settings.comfyPath}". Revisa la ruta de ComfyUI en Ajustes.`,
        log: []
      }
      this.setStatus(status)
      return status
    }

    this.log = []
    this.external = false
    this.setStatus({ state: 'starting', log: [] })

    // Argumentos como arreglo y sin shell: si la ruta trae comillas o espacios
    // no hay forma de que se interprete como comando.
    const args = ['main.py', ...settings.launchArgs.split(' ').filter(Boolean)]

    this.child = spawn(settings.pythonPath, args, {
      cwd: settings.comfyPath,
      shell: false,
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    })

    this.child.stdout?.on('data', (d: Buffer) => this.pushLog(d.toString()))
    this.child.stderr?.on('data', (d: Buffer) => this.pushLog(d.toString()))

    this.child.on('error', (err) => {
      this.setStatus({
        state: 'error',
        message: `No se pudo ejecutar "${settings.pythonPath}": ${err.message}`,
        log: [...this.log]
      })
    })

    this.child.on('exit', (code) => {
      this.child = null
      if (this.status.state !== 'error') {
        this.setStatus(
          code === 0
            ? { state: 'stopped' }
            : {
                state: 'error',
                message: `ComfyUI termino con codigo ${code}`,
                log: [...this.log]
              }
        )
      }
    })

    return this.waitUntilReady()
  }

  private async waitUntilReady(): Promise<ComfyStatus> {
    const deadline = Date.now() + READY_TIMEOUT_MS

    while (Date.now() < deadline) {
      if (this.status.state === 'error') return this.status

      const info = await this.probe()
      if (info) {
        this.setStatus({ state: 'ready', ...info })
        return this.status
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }

    const status: ComfyStatus = {
      state: 'error',
      message: 'ComfyUI no respondio a tiempo. Mira el log para ver que paso.',
      log: [...this.log]
    }
    this.setStatus(status)
    return status
  }

  stop(): void {
    // Si el proceso no es nuestro, no lo tocamos.
    if (this.external || !this.child) {
      this.setStatus({ state: 'stopped' })
      return
    }
    this.child.kill()
    this.child = null
    this.setStatus({ state: 'stopped' })
  }
}

export const comfyProcess = new ComfyProcessManager()
