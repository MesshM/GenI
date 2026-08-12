import type { DatabaseSync } from 'node:sqlite'

export interface Migration {
  version: number
  up(db: DatabaseSync): void
}

/**
 * Reglas para agregar migraciones:
 *  - nunca edites una que ya se publico; agrega una nueva al final
 *  - numeros correlativos, sin huecos
 *  - cada una tiene que poder correr sobre una base con datos reales
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE conversations (
          id         TEXT PRIMARY KEY,
          title      TEXT NOT NULL,
          preset_id  TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE messages (
          id              TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role            TEXT NOT NULL,
          prompt          TEXT NOT NULL DEFAULT '',
          negative        TEXT NOT NULL DEFAULT '',
          params_json     TEXT NOT NULL DEFAULT '{}',
          preset_id       TEXT NOT NULL,
          status          TEXT NOT NULL,
          error           TEXT,
          prompt_id       TEXT,
          created_at      INTEGER NOT NULL
        );

        CREATE TABLE generations (
          id         TEXT PRIMARY KEY,
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          filename   TEXT NOT NULL,
          subfolder  TEXT NOT NULL DEFAULT '',
          abs_path   TEXT NOT NULL,
          width      INTEGER NOT NULL DEFAULT 0,
          height     INTEGER NOT NULL DEFAULT 0,
          seed       INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
        CREATE INDEX idx_generations_message   ON generations(message_id);
        CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
      `)
    }
  }
]
