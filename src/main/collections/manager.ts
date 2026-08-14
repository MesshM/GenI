import { randomUUID } from 'node:crypto'
import { getDb } from '../db'
import { normalizeParams } from '../comfy/params'
import type {
  Collection,
  CollectionItem,
  CreateCollectionInput,
  GenerationParams
} from '@shared/types'

/**
 * Colecciones: albumes de imagenes ya generadas que ademas recuerdan con
 * que receta se hicieron.
 *
 * La gracia no es solo agrupar: al guardar los parametros (y opcionalmente
 * la semilla) se puede abrir una conversacion nueva que arranca configurada
 * igual, y asi seguir la misma linea visual sin volver a ajustar nada.
 */

interface CollectionRow {
  id: string
  name: string
  description: string
  params_json: string | null
  prompt_template: string
  negative_template: string
  recipe_id: string | null
  preset_id: string | null
  locked_seed: number | null
  created_at: number
  item_count: number
  cover: string | null
}

function toCollection(r: CollectionRow): Collection {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    params: r.params_json
      ? normalizeParams(JSON.parse(r.params_json) as GenerationParams)
      : null,
    promptTemplate: r.prompt_template,
    negativeTemplate: r.negative_template,
    recipeId: r.recipe_id,
    presetId: r.preset_id,
    lockedSeed: r.locked_seed,
    createdAt: r.created_at,
    itemCount: r.item_count,
    cover: r.cover
  }
}

const LIST_SQL = `
  SELECT c.*,
         (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS item_count,
         (SELECT g.abs_path
            FROM collection_items ci
            JOIN generations g ON g.id = ci.generation_id
           WHERE ci.collection_id = c.id
           ORDER BY ci.created_at DESC
           LIMIT 1) AS cover
    FROM collections c`

export function listCollections(): Collection[] {
  const rows = getDb()
    .prepare(`${LIST_SQL} ORDER BY c.created_at DESC`)
    .all() as unknown as CollectionRow[]
  return rows.map(toCollection)
}

export function getCollection(id: string): Collection | null {
  const row = getDb().prepare(`${LIST_SQL} WHERE c.id = ?`).get(id) as CollectionRow | undefined
  return row ? toCollection(row) : null
}

export function createCollection(input: CreateCollectionInput): Collection {
  const id = randomUUID()
  const createdAt = Date.now()

  // Si nace desde una imagen concreta, hereda los parametros de ese
  // mensaje: es la forma mas comoda de decir "quiero mas de esto".
  let paramsJson: string | null = null
  let recipeId: string | null = null
  if (input.fromMessageId) {
    const source = getDb()
      .prepare('SELECT params_json, preset_id FROM messages WHERE id = ?')
      .get(input.fromMessageId) as { params_json: string; preset_id: string } | undefined
    if (source) {
      paramsJson = source.params_json
      recipeId = source.preset_id
    }
  }

  getDb()
    .prepare(
      `INSERT INTO collections
         (id, name, description, params_json, prompt_template, negative_template,
          recipe_id, preset_id, locked_seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.description ?? '',
      paramsJson,
      input.promptTemplate ?? '',
      input.negativeTemplate ?? '',
      recipeId,
      input.presetId ?? null,
      input.lockedSeed ?? null,
      createdAt
    )

  return getCollection(id) as Collection
}

export function updateCollection(
  id: string,
  patch: {
    name?: string
    description?: string
    promptTemplate?: string
    negativeTemplate?: string
    presetId?: string | null
    lockedSeed?: number | null
  }
): Collection | null {
  const sets: string[] = []
  const values: (string | number | null)[] = []

  if (patch.name !== undefined) {
    sets.push('name = ?')
    values.push(patch.name)
  }
  if (patch.description !== undefined) {
    sets.push('description = ?')
    values.push(patch.description)
  }
  if (patch.promptTemplate !== undefined) {
    sets.push('prompt_template = ?')
    values.push(patch.promptTemplate)
  }
  if (patch.negativeTemplate !== undefined) {
    sets.push('negative_template = ?')
    values.push(patch.negativeTemplate)
  }
  if (patch.presetId !== undefined) {
    sets.push('preset_id = ?')
    values.push(patch.presetId)
  }
  if (patch.lockedSeed !== undefined) {
    sets.push('locked_seed = ?')
    values.push(patch.lockedSeed)
  }

  if (sets.length > 0) {
    getDb()
      .prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values, id)
  }
  return getCollection(id)
}

export function deleteCollection(id: string): void {
  // Solo se borra el album: las imagenes siguen en su conversacion.
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id)
}

/** Agrega imagenes a una coleccion. Repetir una no la duplica. */
export function addToCollection(collectionId: string, generationIds: string[]): void {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO collection_items (id, collection_id, generation_id, created_at)
     VALUES (?, ?, ?, ?)`
  )
  const now = Date.now()
  for (const generationId of generationIds) {
    stmt.run(randomUUID(), collectionId, generationId, now)
  }
}

export function removeFromCollection(collectionId: string, generationId: string): void {
  getDb()
    .prepare('DELETE FROM collection_items WHERE collection_id = ? AND generation_id = ?')
    .run(collectionId, generationId)
}

interface ItemRow {
  id: string
  generation_id: string
  abs_path: string
  width: number
  height: number
  seed: number
  prompt: string
  negative: string
  conversation_id: string
  conversation_title: string
  added_at: number
}

export function listCollectionItems(collectionId: string): CollectionItem[] {
  const rows = getDb()
    .prepare(
      `SELECT ci.id,
              ci.generation_id,
              g.abs_path,
              g.width,
              g.height,
              g.seed,
              m.prompt,
              m.negative,
              m.conversation_id,
              c.title AS conversation_title,
              ci.created_at AS added_at
         FROM collection_items ci
         JOIN generations   g ON g.id = ci.generation_id
         JOIN messages      m ON m.id = g.message_id
         JOIN conversations c ON c.id = m.conversation_id
        WHERE ci.collection_id = ?
        ORDER BY ci.created_at DESC`
    )
    .all(collectionId) as unknown as ItemRow[]

  return rows.map((r) => ({
    id: r.id,
    generationId: r.generation_id,
    absPath: r.abs_path,
    width: r.width,
    height: r.height,
    seed: r.seed,
    prompt: r.prompt,
    negative: r.negative,
    conversationId: r.conversation_id,
    conversationTitle: r.conversation_title,
    addedAt: r.added_at
  }))
}

/** En que colecciones ya esta una imagen, para marcarlas en el modal. */
export function collectionsForGeneration(generationId: string): string[] {
  const rows = getDb()
    .prepare('SELECT collection_id FROM collection_items WHERE generation_id = ?')
    .all(generationId) as unknown as { collection_id: string }[]
  return rows.map((r) => r.collection_id)
}
