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
  },
  {
    version: 3,
    up(db) {
      // Presets: una configuracion completa de parametros con nombre e imagen
      // de referencia, para volver a cargarla desde el select de Generar.
      // recipe_name queda como copia textual: si el modelo que usaba se borra,
      // la fila sigue siendo legible aunque ya no se pueda seleccionar.
      db.exec(`
        CREATE TABLE presets (
          id                    TEXT PRIMARY KEY,
          name                  TEXT NOT NULL,
          recipe_id             TEXT NOT NULL,
          recipe_name           TEXT NOT NULL,
          params_json           TEXT NOT NULL,
          negative              TEXT NOT NULL DEFAULT '',
          reference_image_path  TEXT,
          created_at            INTEGER NOT NULL
        );

        CREATE INDEX idx_presets_recipe ON presets(recipe_id);
      `)
    }
  },
  {
    version: 4,
    up(db) {
      // Version del archivo en su origen (id de version de Civitai, revision
      // de Hugging Face). Antes de descargar algo se compara contra esto: si
      // coincide con lo ya instalado, no hace falta bajarlo de nuevo.
      db.exec(`ALTER TABLE models ADD COLUMN source_version TEXT;`)
    }
  },
  {
    version: 5,
    up(db) {
      // Colecciones: agrupan imagenes ya generadas y guardan la receta con
      // la que se hicieron, para poder seguir produciendo en la misma linea.
      //
      // params_json y las plantillas de prompt son opcionales: una coleccion
      // puede ser solo un album. Si ademas tiene parametros (o un preset
      // asociado), sirve para abrir una conversacion nueva ya configurada.
      db.exec(`
        CREATE TABLE collections (
          id                TEXT PRIMARY KEY,
          name              TEXT NOT NULL,
          description       TEXT NOT NULL DEFAULT '',
          params_json       TEXT,
          prompt_template   TEXT NOT NULL DEFAULT '',
          negative_template TEXT NOT NULL DEFAULT '',
          recipe_id         TEXT,
          preset_id         TEXT,
          -- Semilla fija: si esta, las conversaciones que nacen de esta
          -- coleccion arrancan con ella en vez de una al azar.
          locked_seed       INTEGER,
          created_at        INTEGER NOT NULL
        );

        CREATE TABLE collection_items (
          id            TEXT PRIMARY KEY,
          collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
          generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
          created_at    INTEGER NOT NULL,
          UNIQUE(collection_id, generation_id)
        );

        CREATE INDEX idx_collection_items_collection ON collection_items(collection_id, created_at DESC);
      `)
    }
  }
]
