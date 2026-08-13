import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { getDb } from '../db'
import { getSettings } from '../settings'
import { classify, FOLDER_BY_KIND, readSafetensorsHeader } from './detect'
import type { ImportResult, ModelAsset, ModelKind } from '@shared/types'

const MODEL_EXTENSIONS = new Set(['.safetensors', '.ckpt', '.pt', '.pth', '.gguf', '.sft'])

/** Carpetas de ComfyUI que se recorren al escanear. */
const SCAN_FOLDERS = [
  'checkpoints',
  'loras',
  'vae',
  'text_encoders',
  'clip',
  'diffusion_models',
  'unet',
  'controlnet',
  'embeddings',
  'upscale_models'
]

interface ModelRow {
  id: string
  kind: string
  architecture: string
  filename: string
  abs_path: string
  size_bytes: number
  trigger_words: string
  source: string
  source_url: string | null
  source_version: string | null
  notes: string
  created_at: number
}

function toAsset(r: ModelRow): ModelAsset {
  return {
    id: r.id,
    kind: r.kind as ModelAsset['kind'],
    architecture: r.architecture as ModelAsset['architecture'],
    filename: r.filename,
    absPath: r.abs_path,
    sizeBytes: r.size_bytes,
    triggerWords: JSON.parse(r.trigger_words) as string[],
    source: r.source as ModelAsset['source'],
    sourceUrl: r.source_url,
    sourceVersion: r.source_version,
    notes: r.notes,
    createdAt: r.created_at
  }
}

/**
 * Busca un modelo ya instalado con el mismo nombre de archivo y el mismo
 * origen. Se usa antes de descargar para no volver a bajar bytes de algo
 * que ya esta: si la version coincide se salta, si no, se trata como una
 * actualizacion.
 */
export function findByFilenameAndSource(
  filename: string,
  source: ModelAsset['source']
): ModelAsset | null {
  const row = getDb()
    .prepare('SELECT * FROM models WHERE filename = ? AND source = ?')
    .get(filename, source) as ModelRow | undefined
  return row ? toAsset(row) : null
}

export function modelsRoot(): string {
  return join(getSettings().comfyPath, 'models')
}

export function listModels(): ModelAsset[] {
  const rows = getDb()
    .prepare('SELECT * FROM models ORDER BY kind, filename')
    .all() as unknown as ModelRow[]
  return rows.map(toAsset)
}

export function getModel(id: string): ModelAsset | null {
  const row = getDb().prepare('SELECT * FROM models WHERE id = ?').get(id) as
    | ModelRow
    | undefined
  return row ? toAsset(row) : null
}

function upsert(asset: Omit<ModelAsset, 'id' | 'createdAt'>): ModelAsset {
  const existing = getDb().prepare('SELECT * FROM models WHERE abs_path = ?').get(asset.absPath) as
    | ModelRow
    | undefined

  if (existing) {
    // Ya estaba indexado: se refresca lo que puede haber cambiado en disco,
    // pero se respetan las notas y los triggers que haya editado el usuario.
    getDb()
      .prepare(
        'UPDATE models SET kind = ?, architecture = ?, size_bytes = ?, source_version = ? WHERE id = ?'
      )
      .run(asset.kind, asset.architecture, asset.sizeBytes, asset.sourceVersion, existing.id)
    return toAsset({
      ...existing,
      kind: asset.kind,
      architecture: asset.architecture,
      size_bytes: asset.sizeBytes,
      source_version: asset.sourceVersion
    })
  }

  const id = randomUUID()
  const createdAt = Date.now()
  getDb()
    .prepare(
      `INSERT INTO models
         (id, kind, architecture, filename, abs_path, size_bytes, trigger_words, source, source_url, source_version, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      asset.kind,
      asset.architecture,
      asset.filename,
      asset.absPath,
      asset.sizeBytes,
      JSON.stringify(asset.triggerWords),
      asset.source,
      asset.sourceUrl,
      asset.sourceVersion,
      asset.notes,
      createdAt
    )

  return { id, createdAt, ...asset }
}

/**
 * Recorre las carpetas de modelos de ComfyUI y actualiza el catalogo.
 * Los archivos que ya no existen se sacan del indice; el archivo en disco
 * es siempre la fuente de verdad.
 */
export async function scanModels(): Promise<{ found: number; removed: number }> {
  const root = modelsRoot()
  const seen = new Set<string>()
  let found = 0

  for (const folder of SCAN_FOLDERS) {
    const dir = join(root, folder)
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue // la carpeta puede no existir en instalaciones viejas
    }

    for (const entry of entries) {
      if (!MODEL_EXTENSIONS.has(extname(entry).toLowerCase())) continue

      const absPath = join(dir, entry)
      seen.add(absPath)

      // Si ya esta indexado no se vuelve a leer la cabecera: es lo caro.
      const known = getDb().prepare('SELECT id FROM models WHERE abs_path = ?').get(absPath)
      if (known) {
        found++
        continue
      }

      const info = await stat(absPath).catch(() => null)
      if (!info) continue

      const header = await readSafetensorsHeader(absPath)
      const detection = header
        ? classify(header, absPath)
        : { kind: kindFromFolder(folder), architecture: 'unknown' as const, triggerWords: [], reason: 'por carpeta' }

      upsert({
        kind: detection.kind,
        architecture: detection.architecture,
        filename: entry,
        absPath,
        sizeBytes: info.size,
        triggerWords: detection.triggerWords,
        source: 'scan',
        sourceUrl: null,
        sourceVersion: null,
        notes: ''
      })
      found++
    }
  }

  // Limpia lo que ya no esta en disco.
  const all = getDb().prepare('SELECT id, abs_path FROM models').all() as unknown as {
    id: string
    abs_path: string
  }[]
  let removed = 0
  for (const row of all) {
    if (!seen.has(row.abs_path)) {
      getDb().prepare('DELETE FROM models WHERE id = ?').run(row.id)
      removed++
    }
  }

  return { found, removed }
}

/** Para formatos sin cabecera legible (.ckpt, .pt) el tipo sale de la carpeta. */
function kindFromFolder(folder: string): ModelKind {
  const map: Record<string, ModelKind> = {
    checkpoints: 'checkpoint',
    loras: 'lora',
    vae: 'vae',
    text_encoders: 'text_encoder',
    clip: 'text_encoder',
    diffusion_models: 'diffusion_model',
    unet: 'diffusion_model',
    controlnet: 'controlnet',
    embeddings: 'embedding',
    upscale_models: 'upscale_model'
  }
  return map[folder] ?? 'unknown'
}

/**
 * Importa un archivo sueltandolo en la app: lee su cabecera, deduce que es y
 * lo deja en la carpeta que le corresponde.
 *
 * Si el archivo ya esta dentro de la carpeta de modelos se mueve; si viene de
 * otro disco se copia (mover entre volumenes falla).
 */
export async function importModelFile(sourcePath: string): Promise<ImportResult> {
  const filename = basename(sourcePath)

  try {
    const info = await stat(sourcePath)
    if (!info.isFile()) {
      return failed(filename, 'No es un archivo')
    }
    if (!MODEL_EXTENSIONS.has(extname(filename).toLowerCase())) {
      return failed(filename, 'Extension no reconocida como modelo')
    }

    const header = await readSafetensorsHeader(sourcePath)
    if (!header) {
      return failed(filename, 'No se pudo leer la cabecera; puede estar incompleto o no ser safetensors')
    }

    const detection = classify(header, sourcePath)
    if (detection.kind === 'unknown') {
      return failed(filename, `No pude identificar el tipo: ${detection.reason}`)
    }

    const targetDir = join(modelsRoot(), FOLDER_BY_KIND[detection.kind])
    await mkdir(targetDir, { recursive: true })
    const targetPath = await uniquePath(join(targetDir, filename))

    // Mover dentro del mismo volumen es instantaneo; entre volumenes falla
    // con EXDEV y hay que copiar.
    try {
      await rename(sourcePath, targetPath)
    } catch {
      await copyFile(sourcePath, targetPath)
    }

    const finalInfo = await stat(targetPath)
    upsert({
      kind: detection.kind,
      architecture: detection.architecture,
      filename: basename(targetPath),
      absPath: targetPath,
      sizeBytes: finalInfo.size,
      triggerWords: detection.triggerWords,
      source: 'import',
      sourceUrl: null,
      sourceVersion: null,
      notes: ''
    })

    return {
      ok: true,
      filename: basename(targetPath),
      kind: detection.kind,
      architecture: detection.architecture,
      reason: detection.reason
    }
  } catch (err) {
    return failed(filename, err instanceof Error ? err.message : String(err))
  }
}

function failed(filename: string, error: string): ImportResult {
  return { ok: false, filename, kind: 'unknown', architecture: 'unknown', reason: '', error }
}

/** Evita pisar un archivo existente agregando un sufijo numerico. */
async function uniquePath(candidate: string): Promise<string> {
  const dir = dirname(candidate)
  const ext = extname(candidate)
  const stem = basename(candidate, ext)

  let attempt = candidate
  let n = 1
  while (true) {
    try {
      await stat(attempt)
      attempt = join(dir, `${stem} (${n})${ext}`)
      n++
    } catch {
      return attempt
    }
  }
}

/**
 * Borra un modelo del disco y del catalogo.
 * Solo se permite borrar dentro de la carpeta de modelos de ComfyUI: si el
 * registro apuntara a otro lado, se rechaza en vez de borrar algo ajeno.
 */
export async function deleteModel(id: string): Promise<void> {
  const model = getModel(id)
  if (!model) throw new Error('Ese modelo ya no esta en el catalogo')

  const root = resolve(modelsRoot())
  const target = resolve(model.absPath)
  if (!target.startsWith(root)) {
    throw new Error('El archivo esta fuera de la carpeta de modelos; no se borra por seguridad')
  }

  await unlink(target).catch((err: NodeJS.ErrnoException) => {
    // Si ya no existe, seguimos: el objetivo era que dejara de estar.
    if (err.code !== 'ENOENT') throw err
  })
  getDb().prepare('DELETE FROM models WHERE id = ?').run(id)
}

export function updateModel(
  id: string,
  patch: { triggerWords?: string[]; notes?: string }
): ModelAsset | null {
  if (patch.triggerWords) {
    getDb()
      .prepare('UPDATE models SET trigger_words = ? WHERE id = ?')
      .run(JSON.stringify(patch.triggerWords), id)
  }
  if (patch.notes !== undefined) {
    getDb().prepare('UPDATE models SET notes = ? WHERE id = ?').run(patch.notes, id)
  }
  return getModel(id)
}

export { upsert as upsertModel }
