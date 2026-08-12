import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import type {
  Conversation,
  Generation,
  GenerationParams,
  Message,
  MessageStatus
} from '@shared/types'

const now = (): number => Date.now()

// ---------------------------------------------------------------- settings

export const settingsRepo = {
  all(): Record<string, string> {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  },

  set(key: string, value: string): void {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value)
  }
}

// ----------------------------------------------------------- conversations

interface ConversationRow {
  id: string
  title: string
  preset_id: string
  created_at: number
  updated_at: number
  thumbnail: string | null
  message_count: number
}

export const conversationsRepo = {
  list(): Conversation[] {
    const rows = getDb()
      .prepare(
        `SELECT c.id, c.title, c.preset_id, c.created_at, c.updated_at,
                (SELECT g.abs_path
                   FROM generations g
                   JOIN messages m ON m.id = g.message_id
                  WHERE m.conversation_id = c.id
                  ORDER BY g.created_at DESC LIMIT 1) AS thumbnail,
                (SELECT COUNT(*) FROM messages m2 WHERE m2.conversation_id = c.id) AS message_count
           FROM conversations c
          ORDER BY c.updated_at DESC`
      )
      .all() as unknown as ConversationRow[]

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      presetId: r.preset_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      thumbnail: r.thumbnail,
      messageCount: r.message_count
    }))
  },

  create(presetId: string, title = 'Nueva conversacion'): Conversation {
    const id = randomUUID()
    const ts = now()
    getDb()
      .prepare(
        `INSERT INTO conversations (id, title, preset_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, title, presetId, ts, ts)

    return {
      id,
      title,
      presetId,
      createdAt: ts,
      updatedAt: ts,
      thumbnail: null,
      messageCount: 0
    }
  },

  rename(id: string, title: string): void {
    getDb()
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, now(), id)
  },

  touch(id: string): void {
    getDb().prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now(), id)
  },

  remove(id: string): void {
    // Los mensajes y generaciones caen por ON DELETE CASCADE.
    getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id)
  },

  /** Usa el primer prompt como titulo, si la conversacion sigue sin nombre. */
  autoTitle(id: string, prompt: string): void {
    const row = getDb().prepare('SELECT title FROM conversations WHERE id = ?').get(id) as
      | { title: string }
      | undefined
    if (!row || row.title !== 'Nueva conversacion') return

    const clean = prompt.replace(/\s+/g, ' ').trim()
    if (!clean) return
    const title = clean.length > 48 ? `${clean.slice(0, 48)}...` : clean
    conversationsRepo.rename(id, title)
  }
}

// --------------------------------------------------------------- messages

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  prompt: string
  negative: string
  params_json: string
  preset_id: string
  status: string
  error: string | null
  prompt_id: string | null
  created_at: number
}

interface GenerationRow {
  id: string
  message_id: string
  filename: string
  subfolder: string
  abs_path: string
  width: number
  height: number
  seed: number
  created_at: number
}

function toGeneration(r: GenerationRow): Generation {
  return {
    id: r.id,
    messageId: r.message_id,
    filename: r.filename,
    subfolder: r.subfolder,
    absPath: r.abs_path,
    width: r.width,
    height: r.height,
    seed: r.seed,
    createdAt: r.created_at
  }
}

function toMessage(r: MessageRow, generations: Generation[]): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role as Message['role'],
    prompt: r.prompt,
    negative: r.negative,
    params: JSON.parse(r.params_json) as GenerationParams,
    presetId: r.preset_id,
    status: r.status as MessageStatus,
    error: r.error,
    promptId: r.prompt_id,
    createdAt: r.created_at,
    generations
  }
}

export const messagesRepo = {
  byConversation(conversationId: string): Message[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as unknown as MessageRow[]

    if (rows.length === 0) return []

    const gens = db
      .prepare(
        `SELECT g.* FROM generations g
           JOIN messages m ON m.id = g.message_id
          WHERE m.conversation_id = ?
          ORDER BY g.created_at ASC`
      )
      .all(conversationId) as unknown as GenerationRow[]

    const byMessage = new Map<string, Generation[]>()
    for (const g of gens) {
      const list = byMessage.get(g.message_id) ?? []
      list.push(toGeneration(g))
      byMessage.set(g.message_id, list)
    }

    return rows.map((r) => toMessage(r, byMessage.get(r.id) ?? []))
  },

  get(id: string): Message | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as
      | MessageRow
      | undefined
    if (!row) return null

    const gens = db
      .prepare('SELECT * FROM generations WHERE message_id = ? ORDER BY created_at ASC')
      .all(id) as unknown as GenerationRow[]

    return toMessage(row, gens.map(toGeneration))
  },

  create(input: {
    conversationId: string
    role: Message['role']
    prompt: string
    negative: string
    params: GenerationParams
    presetId: string
    status: MessageStatus
  }): Message {
    const id = randomUUID()
    const ts = now()
    getDb()
      .prepare(
        `INSERT INTO messages
           (id, conversation_id, role, prompt, negative, params_json, preset_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.conversationId,
        input.role,
        input.prompt,
        input.negative,
        JSON.stringify(input.params),
        input.presetId,
        input.status,
        ts
      )

    conversationsRepo.touch(input.conversationId)

    return {
      id,
      conversationId: input.conversationId,
      role: input.role,
      prompt: input.prompt,
      negative: input.negative,
      params: input.params,
      presetId: input.presetId,
      status: input.status,
      error: null,
      promptId: null,
      createdAt: ts,
      generations: []
    }
  },

  setStatus(id: string, status: MessageStatus, error: string | null = null): void {
    getDb().prepare('UPDATE messages SET status = ?, error = ? WHERE id = ?').run(status, error, id)
  },

  setPromptId(id: string, promptId: string): void {
    getDb().prepare('UPDATE messages SET prompt_id = ? WHERE id = ?').run(promptId, id)
  },

  /** Marca como fallidos los mensajes que quedaron a medias si la app se cerro de golpe. */
  failStale(): void {
    getDb()
      .prepare(
        `UPDATE messages
            SET status = 'error',
                error  = 'La aplicacion se cerro mientras se generaba'
          WHERE status IN ('pending', 'running')`
      )
      .run()
  }
}

export const generationsRepo = {
  create(input: {
    messageId: string
    filename: string
    subfolder: string
    absPath: string
    width: number
    height: number
    seed: number
  }): Generation {
    const id = randomUUID()
    const ts = now()
    getDb()
      .prepare(
        `INSERT INTO generations
           (id, message_id, filename, subfolder, abs_path, width, height, seed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.messageId,
        input.filename,
        input.subfolder,
        input.absPath,
        input.width,
        input.height,
        input.seed,
        ts
      )

    return { id, createdAt: ts, ...input }
  }
}
