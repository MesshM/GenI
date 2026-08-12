import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { Preset } from '@shared/types'

let cache: Preset[] | null = null

/**
 * En desarrollo los presets estan en el repo; empaquetados van a
 * resources/ dentro del directorio de la aplicacion.
 */
function presetsDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', 'presets')
    : join(app.getAppPath(), 'resources', 'presets')
}

export function loadPresets(): Preset[] {
  if (cache) return cache

  const dir = presetsDir()
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as string[]

  cache = index
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Preset)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return cache
}

export function getPreset(id: string): Preset {
  const preset = loadPresets().find((p) => p.id === id)
  if (!preset) throw new Error(`No existe el preset "${id}"`)
  return preset
}
