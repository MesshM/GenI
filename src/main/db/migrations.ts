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
  },
  {
    version: 2,
    up(db) {
      // Catalogo de modelos instalados. El archivo manda: esta tabla es un
      // indice sobre las carpetas de ComfyUI, y se resincroniza al escanear.
      db.exec(`
        CREATE TABLE models (
          id             TEXT PRIMARY KEY,
          kind           TEXT NOT NULL,
          architecture   TEXT NOT NULL DEFAULT 'unknown',
          filename       TEXT NOT NULL,
          abs_path       TEXT NOT NULL UNIQUE,
          size_bytes     INTEGER NOT NULL DEFAULT 0,
          trigger_words  TEXT NOT NULL DEFAULT '[]',
          source         TEXT NOT NULL DEFAULT 'scan',
          source_url     TEXT,
          notes          TEXT NOT NULL DEFAULT '',
          created_at     INTEGER NOT NULL
        );

        CREATE INDEX idx_models_kind ON models(kind, filename);
      `)
    }
  }
]
