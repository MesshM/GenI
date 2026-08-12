import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { app } from 'electron'
import { MIGRATIONS } from './migrations'

let db: DatabaseSync | null = null

/**
 * La base vive en userData (%APPDATA%\geni), fuera de la carpeta del programa.
 * Por eso una actualizacion nunca la pisa.
 */
export function getDbPath(): string {
  return join(app.getPath('userData'), 'geni.db')
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('La base de datos no esta abierta')
  return db
}

export function openDatabase(): DatabaseSync {
  if (db) return db

  db = new DatabaseSync(getDbPath())
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Migraciones numeradas y aplicadas en orden, una sola vez cada una.
 * Es lo que permite publicar versiones nuevas sin perder los datos:
 * al abrir, la app lleva el esquema desde donde este hasta el actual.
 */
function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    )
  `)

  const row = database.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined

  let current = row?.version ?? 0
  if (!row) {
    database.prepare('INSERT INTO schema_version (version) VALUES (0)').run()
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue

    database.exec('BEGIN')
    try {
      migration.up(database)
      database.prepare('UPDATE schema_version SET version = ?').run(migration.version)
      database.exec('COMMIT')
      current = migration.version
      console.log(`[db] migracion ${migration.version} aplicada`)
    } catch (err) {
      database.exec('ROLLBACK')
      throw new Error(
        `Fallo la migracion ${migration.version}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}
