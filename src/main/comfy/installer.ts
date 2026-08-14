import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import type { ComfyInstallProgress, GpuVendor } from '@shared/types'

/**
 * Instala ComfyUI desde cero para quien todavia no lo tiene.
 *
 * No se usa el paquete "portable" oficial: solo existe para NVIDIA. Aca se
 * baja el codigo del repo y se arma un entorno de Python propio, eligiendo
 * la rueda de PyTorch segun la placa que haya (ROCm para AMD, CUDA para
 * NVIDIA, CPU si no se reconoce ninguna). Es la unica forma de que la misma
 * instalacion sirva en las dos marcas.
 */

const SOURCE_ZIP = 'https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/master.zip'

/** De donde sale PyTorch segun la placa. */
const TORCH_INDEX: Record<GpuVendor, string | null> = {
  // ROCm para Windows todavia se publica aparte del indice principal.
  amd: 'https://repo.radeon.com/rocm/manylinux/rocm-rel-6.2/',
  nvidia: 'https://download.pytorch.org/whl/cu124',
  // Sin placa reconocida se instala la version de CPU: anda, pero lento.
  unknown: null
}

class ComfyInstaller extends EventEmitter {
  private running = false

  isRunning(): boolean {
    return this.running
  }

  private emitStep(step: string, log?: string, percent?: number): void {
    this.emit('progress', {
      step,
      log: log ?? '',
      percent: percent ?? -1,
      done: false,
      error: null
    } satisfies ComfyInstallProgress)
  }

  /**
   * Deja ComfyUI listo en `targetDir` y devuelve la ruta final.
   * Los pasos se emiten por 'progress' para que la interfaz los muestre.
   */
  async install(targetDir: string, pythonPath: string, vendor: GpuVendor): Promise<string> {
    if (this.running) throw new Error('Ya hay una instalacion en curso')
    this.running = true

    const zipPath = join(tmpdir(), `comfyui-${Date.now()}.zip`)

    try {
      await mkdir(targetDir, { recursive: true })

      // 1. Codigo fuente
      this.emitStep('Descargando ComfyUI', SOURCE_ZIP, 0)
      await this.download(SOURCE_ZIP, zipPath)

      // 2. Descomprimir. El zip de GitHub trae todo dentro de
      //    "ComfyUI-master/", asi que ese nivel se aplana.
      this.emitStep('Descomprimiendo', '', 35)
      const extractDir = join(tmpdir(), `comfyui-extract-${Date.now()}`)
      new AdmZip(zipPath).extractAllTo(extractDir, true)

      const entries = await readdir(extractDir)
      const root = entries.length === 1 ? join(extractDir, entries[0]) : extractDir
      for (const name of await readdir(root)) {
        await rename(join(root, name), join(targetDir, name)).catch(() => undefined)
      }
      await rm(extractDir, { recursive: true, force: true }).catch(() => undefined)
      await rm(zipPath, { force: true }).catch(() => undefined)

      // 3. Entorno virtual propio, para no tocar el Python del sistema.
      this.emitStep('Creando el entorno de Python', '', 45)
      const venvDir = join(targetDir, 'venv')
      await this.run(pythonPath, ['-m', 'venv', venvDir], targetDir)

      const venvPython =
        process.platform === 'win32'
          ? join(venvDir, 'Scripts', 'python.exe')
          : join(venvDir, 'bin', 'python')

      // 4. PyTorch primero y aparte: es lo que cambia entre placas, y si se
      //    instala despues de los requisitos pip puede pisarlo por la version
      //    generica de CPU.
      this.emitStep('Instalando PyTorch', `placa: ${vendor}`, 55)
      const index = TORCH_INDEX[vendor]
      await this.run(
        venvPython,
        [
          '-m',
          'pip',
          'install',
          'torch',
          'torchvision',
          'torchaudio',
          ...(index ? ['--index-url', index] : [])
        ],
        targetDir
      )

      // 5. El resto de las dependencias de ComfyUI.
      this.emitStep('Instalando dependencias de ComfyUI', '', 80)
      await this.run(
        venvPython,
        ['-m', 'pip', 'install', '-r', join(targetDir, 'requirements.txt')],
        targetDir
      )

      // 6. Carpetas de modelos, para que la app pueda escanearlas ya.
      this.emitStep('Preparando carpetas de modelos', '', 95)
      for (const folder of [
        'checkpoints',
        'loras',
        'vae',
        'text_encoders',
        'diffusion_models',
        'controlnet',
        'embeddings',
        'upscale_models'
      ]) {
        await mkdir(join(targetDir, 'models', folder), { recursive: true })
      }

      this.emit('progress', {
        step: 'Listo',
        log: '',
        percent: 100,
        done: true,
        error: null,
        pythonPath: venvPython
      } satisfies ComfyInstallProgress)

      return targetDir
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('progress', {
        step: 'Error',
        log: '',
        percent: -1,
        done: false,
        error: message
      } satisfies ComfyInstallProgress)
      throw err
    } finally {
      this.running = false
    }
  }

  private async download(url: string, target: string): Promise<void> {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error(`No se pudo descargar ComfyUI (${res.status})`)

    const total = Number(res.headers.get('content-length') ?? 0)
    let received = 0
    let lastEmit = 0

    const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
    source.on('data', (chunk: Buffer) => {
      received += chunk.length
      const now = Date.now()
      if (now - lastEmit > 300) {
        lastEmit = now
        // La descarga es el primer tercio del total.
        const pct = total > 0 ? Math.round((received / total) * 33) : -1
        this.emitStep('Descargando ComfyUI', `${(received / 1_048_576).toFixed(0)} MB`, pct)
      }
    })

    await pipeline(source, createWriteStream(target))
  }

  /** Corre un comando y reenvia su salida como log, linea por linea. */
  private run(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, windowsHide: true })
      let lastLine = ''

      const onData = (buf: Buffer): void => {
        const text = buf.toString()
        for (const line of text.split(/\r?\n/)) {
          const clean = line.trim()
          if (clean) lastLine = clean
        }
        this.emit('log', lastLine)
      }

      child.stdout.on('data', onData)
      child.stderr.on('data', onData)

      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`"${command} ${args[0]} ..." termino con codigo ${code}: ${lastLine}`))
      })
    })
  }
}

/**
 * Que placa hay, para elegir la rueda de PyTorch. Se pregunta al sistema en
 * vez de asumir: la respuesta cambia la descarga en varios GB.
 */
export async function detectGpuVendor(): Promise<GpuVendor> {
  if (process.platform !== 'win32') return 'unknown'
  return new Promise((resolve) => {
    const child = spawn(
      'powershell',
      ['-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController).Name'],
      { windowsHide: true }
    )
    let out = ''
    child.stdout.on('data', (b: Buffer) => (out += b.toString()))
    child.on('error', () => resolve('unknown'))
    child.on('close', () => {
      const lower = out.toLowerCase()
      if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('rtx')) {
        resolve('nvidia')
      } else if (lower.includes('amd') || lower.includes('radeon')) {
        resolve('amd')
      } else {
        resolve('unknown')
      }
    })
  })
}

/** Python del sistema, si lo hay. Sin el no se puede armar el entorno. */
export async function detectPython(): Promise<string | null> {
  for (const candidate of ['python', 'python3', 'py']) {
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(candidate, ['--version'], { windowsHide: true })
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    })
    if (ok) return candidate
  }
  return null
}

/** Carpeta por defecto donde instalar, si el usuario no elige otra. */
export async function defaultInstallDir(home: string): Promise<string> {
  const base = join(home, 'ComfyUI')
  try {
    await stat(base)
    return `${base}-GenI`
  } catch {
    return base
  }
}

export const comfyInstaller = new ComfyInstaller()
