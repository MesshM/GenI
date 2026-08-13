import { unlink } from 'node:fs/promises'
import sharp from 'sharp'

/**
 * ComfyUI escribe PNG (su unico formato de salida nativo). Se recomprime a
 * WEBP aca, fuera del grafo: el nodo "Save Animated WEBP" de ComfyUI trata
 * todo el batch como los frames de UN video, asi que un batch de 4 imagenes
 * terminaria en un solo archivo animado en vez de 4 archivos sueltos. Re-
 * codificar cada PNG por separado despues conserva "un archivo por imagen".
 */
export async function convertPngToWebp(pngAbsPath: string, quality = 90): Promise<string> {
  const webpAbsPath = pngAbsPath.replace(/\.png$/i, '.webp')
  await sharp(pngAbsPath).webp({ quality, lossless: false }).toFile(webpAbsPath)
  await unlink(pngAbsPath)
  return webpAbsPath
}
