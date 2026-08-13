import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, stat, unlink } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { app } from 'electron'
import { getDb } from '../db'
import type { CreatePresetInput, ParamPreset } from '@shared/types'

interface PresetRow {
  id: string
  name: string
  recipe_id: string
  recipe_name: string
  params_json: string
  negative: string
  reference_image_path: string | null
  created_at: number
}

function toPreset(r: PresetRow): ParamPreset {
  return {
    id: r.id,
    name: r.name,
    recipeId: r.recipe_id,
    recipeName: r.recipe_name,
    params: JSON.parse(r.params_json),
    negative: r.negative,
    referenceImagePath: r.reference_image_path,
    createdAt: r.created_at
  }
}

/** Carpeta donde viven las imagenes de referencia, fuera de ComfyUI. */
export function presetsImagesRoot(): string {
  return join(app.getPath('userData'), 'presets')
}

export function listPresets(): ParamPreset[] {
  const rows = getDb()
    .prepare('SELECT * FROM presets ORDER BY created_at DESC')
    .all() as unknown as PresetRow[]
  return rows.map(toPreset)
}

export async function createPreset(input: CreatePresetInput): Promise<ParamPreset> {
  const id = randomUUID()
  const createdAt = Date.now()

  let referenceImagePath: string | null = null
  if (input.referenceImageSourcePath) {
    const dir = presetsImagesRoot()
    await mkdir(dir, { recursive: true })
    const ext = extname(input.referenceImageSourcePath) || '.png'
    const target = join(dir, `${id}${ext}`)
    await copyFile(input.referenceImageSourcePath, target)
    referenceImagePath = target
  }

  getDb()
    .prepare(
      `INSERT INTO presets
         (id, name, recipe_id, recipe_name, params_json, negative, reference_image_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.recipeId,
      input.recipeName,
      JSON.stringify(input.params),
      input.negative,
      referenceImagePath,
      createdAt
    )

  return {
    id,
    name: input.name,
    recipeId: input.recipeId,
    recipeName: input.recipeName,
    params: input.params,
    negative: input.negative,
    referenceImagePath,
    createdAt
  }
}

/** Borra la fila y, si tiene, su imagen de referencia. Solo dentro de su propia carpeta. */
export async function deletePreset(id: string): Promise<void> {
  const row = getDb().prepare('SELECT * FROM presets WHERE id = ?').get(id) as
    | PresetRow
    | undefined
  if (!row) return

  if (row.reference_image_path) {
    const root = resolve(presetsImagesRoot())
    const target = resolve(row.reference_image_path)
    if (target.startsWith(root)) {
      await unlink(target).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') throw err
      })
    }
  }

  getDb().prepare('DELETE FROM presets WHERE id = ?').run(id)
}

/** Confirma que el archivo de referencia elegido existe y es una imagen razonable. */
export async function isImageFile(path: string): Promise<boolean> {
  const ok = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extname(path).toLowerCase())
  if (!ok) return false
  const info = await stat(path).catch(() => null)
  return Boolean(info?.isFile())
}
