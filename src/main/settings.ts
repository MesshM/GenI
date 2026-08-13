import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { settingsRepo } from './db/repositories'
import type { AppSettings } from '@shared/types'

const DEFAULTS: AppSettings = {
  comfyPath: '',
  pythonPath: 'python',
  // Esta maquina tiene el archivo de paginacion desactivado; sin este flag
  // ComfyUI falla al cargar modelos con "paging file is too small".
  launchArgs: '--enable-manager --disable-pinned-memory',
  autoStartComfy: true,
  comfyHost: '127.0.0.1',
  comfyPort: 8188,
  theme: 'light',
  civitaiToken: '',
  huggingFaceToken: ''
}

/** Rutas donde suele estar ComfyUI, para no obligar a buscarla a mano. */
const CANDIDATES = [
  join(homedir(), 'AI', 'ComfyUI'),
  join(homedir(), 'ComfyUI'),
  join(homedir(), 'Documents', 'ComfyUI'),
  'C:\\ComfyUI'
]

export function isComfyFolder(dir: string): boolean {
  return Boolean(dir) && existsSync(join(dir, 'main.py'))
}

export function detectComfy(): string | null {
  return CANDIDATES.find(isComfyFolder) ?? null
}

export function getSettings(): AppSettings {
  const stored = settingsRepo.all()
  return {
    comfyPath: stored.comfyPath ?? DEFAULTS.comfyPath,
    pythonPath: stored.pythonPath ?? DEFAULTS.pythonPath,
    launchArgs: stored.launchArgs ?? DEFAULTS.launchArgs,
    autoStartComfy: (stored.autoStartComfy ?? String(DEFAULTS.autoStartComfy)) === 'true',
    comfyHost: stored.comfyHost ?? DEFAULTS.comfyHost,
    comfyPort: Number(stored.comfyPort ?? DEFAULTS.comfyPort),
    theme: (stored.theme as AppSettings['theme']) ?? DEFAULTS.theme,
    civitaiToken: stored.civitaiToken ?? DEFAULTS.civitaiToken,
    huggingFaceToken: stored.huggingFaceToken ?? DEFAULTS.huggingFaceToken
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    settingsRepo.set(key, String(value))
  }
  return getSettings()
}

export function comfyBaseUrl(s: AppSettings = getSettings()): string {
  return `http://${s.comfyHost}:${s.comfyPort}`
}
