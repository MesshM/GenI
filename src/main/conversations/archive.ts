import AdmZip from 'adm-zip'
import { readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { getSettings } from '../settings'

/**
 * Comprime/descomprime la carpeta de imagenes de una conversacion.
 *
 * ComfyUI escribe cada generacion directo en su subcarpeta propia (via
 * filename_prefix con barras, verificado contra la API real: crea el
 * directorio solo). Eso es lo que hace posible operar por conversacion sin
 * tener que mover archivos despues de generarlos.
 *
 * Solo la conversacion activa queda descomprimida; al cambiar de
 * conversacion se comprime la anterior y se descomprime la nueva.
 */

function geniOutputRoot(): string {
  return join(getSettings().comfyPath, 'output', 'geni')
}

export function conversationDir(conversationId: string): string {
  return join(geniOutputRoot(), conversationId)
}

export function conversationZipPath(conversationId: string): string {
  return join(geniOutputRoot(), `${conversationId}.zip`)
}

/**
 * Comprime la carpeta de la conversacion y borra los archivos sueltos.
 *
 * Si ya existe un .zip de una compresion anterior (por ejemplo, una
 * generacion que termino justo despues de comprimir y escribio en una
 * carpeta nueva) los entries se agregan al zip existente en vez de
 * pisarlo, asi nunca se pierde una imagen por una carrera de tiempos.
 */
export async function compressConversation(conversationId: string): Promise<void> {
  const dir = conversationDir(conversationId)
  if (!existsSync(dir)) return

  const files = await readdir(dir)
  if (files.length === 0) {
    await rm(dir, { recursive: true, force: true })
    return
  }

  const zipPath = conversationZipPath(conversationId)
  const zip = existsSync(zipPath) ? new AdmZip(zipPath) : new AdmZip()

  for (const file of files) {
    const full = join(dir, file)
    const info = await stat(full)
    if (!info.isFile()) continue
    // addLocalFile no permite duplicados: se saca la entrada vieja primero
    // por si esto es una re-compresion sobre un zip que ya la tenia.
    zip.deleteFile(file)
    zip.addLocalFile(full)
  }

  zip.writeZip(zipPath)
  await rm(dir, { recursive: true, force: true })
}

/** Extrae el zip de vuelta a la carpeta y lo borra. Si no hay zip, no hace nada. */
export async function decompressConversation(conversationId: string): Promise<void> {
  const zipPath = conversationZipPath(conversationId)
  if (!existsSync(zipPath)) return

  const dir = conversationDir(conversationId)
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(dir, true)
  await rm(zipPath, { force: true })
}

/**
 * Una sola imagen desde el zip, sin descomprimir el resto — para las
 * miniaturas de conversaciones que no estan activas en este momento.
 * Sincrono porque adm-zip lo es y el volumen es chico (una imagen).
 */
export function readZipEntry(conversationId: string, filename: string): Buffer | null {
  const zipPath = conversationZipPath(conversationId)
  if (!existsSync(zipPath)) return null

  try {
    const zip = new AdmZip(zipPath)
    return zip.readFile(filename)
  } catch {
    return null
  }
}

/** Borra ambas representaciones posibles (carpeta suelta y/o zip). Silencioso. */
export async function deleteConversationFiles(conversationId: string): Promise<void> {
  await rm(conversationDir(conversationId), { recursive: true, force: true }).catch(() => undefined)
  await rm(conversationZipPath(conversationId), { force: true }).catch(() => undefined)
}

/**
 * Dado un path que geni-file:// no pudo servir directo, intenta resolverlo
 * como "geni/<conversationId>/<archivo>" dentro de su zip. Devuelve null si
 * la ruta no tiene esa forma o el archivo no esta en el zip.
 */
export function resolveFromZip(absPath: string): Buffer | null {
  const root = resolve(geniOutputRoot())
  const target = resolve(absPath)
  if (!target.startsWith(root + sep)) return null

  const rel = target.slice(root.length + 1)
  const parts = rel.split(/[\\/]/)
  if (parts.length !== 2) return null

  const [conversationId, filename] = parts
  return readZipEntry(conversationId, filename)
}
