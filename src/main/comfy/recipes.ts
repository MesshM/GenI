import { listModels } from '../models/manager'
import type { GenerationParams, ModelAsset, Recipe } from '@shared/types'

/**
 * Las recetas no se guardan: se derivan del catalogo de modelos cada vez.
 *
 * Asi, apenas se instala un checkpoint nuevo aparece su receta, y si se borra
 * un modelo la receta desaparece sola. No hay estado que se pueda desincronizar
 * de lo que hay en disco.
 */

const SDXL_RESOLUTIONS = [
  { label: 'Cuadrado 1:1', width: 1408, height: 1408 },
  { label: 'Retrato 4:5', width: 1280, height: 1600 },
  { label: 'Retrato 2:3', width: 1152, height: 1728 },
  { label: 'Vertical 3:4', width: 1248, height: 1664 },
  { label: 'Celular 9:16', width: 1080, height: 1920 },
  { label: 'Celular alto 9:20', width: 1080, height: 2400 },
  { label: 'Escritorio 16:9', width: 1920, height: 1080 },
  { label: 'Horizontal 3:2', width: 1728, height: 1152 },
  { label: 'Horizontal 4:3', width: 1664, height: 1248 },
  { label: 'Panoramica 21:9', width: 2304, height: 960 },
  { label: 'Cuadrado chico', width: 1024, height: 1024 },
  { label: 'Miniatura 16:9', width: 1280, height: 720 }
]

// FLUX rinde mejor pegado a multiplos de 64 y cerca de 1 MP; por eso las
// medidas no coinciden con las de SDXL aunque la proporcion sea la misma.
const FLUX_RESOLUTIONS = [
  { label: 'Cuadrado 1:1', width: 1024, height: 1024 },
  { label: 'Retrato 4:5', width: 896, height: 1088 },
  { label: 'Retrato 2:3', width: 832, height: 1216 },
  { label: 'Vertical 3:4', width: 896, height: 1152 },
  { label: 'Celular 9:16', width: 832, height: 1472 },
  { label: 'Celular alto 9:20', width: 768, height: 1664 },
  { label: 'Escritorio 16:9', width: 1472, height: 832 },
  { label: 'Horizontal 3:2', width: 1216, height: 832 },
  { label: 'Horizontal 4:3', width: 1152, height: 896 },
  { label: 'Panoramica 21:9', width: 1600, height: 704 },
  { label: 'Cuadrado grande', width: 1216, height: 1216 }
]

const NEGATIVE_SDXL =
  'worst quality, low quality, lowres, bad anatomy, bad hands, mutated hands, extra digits, ' +
  'fewer digits, extra arms, jpeg artifacts, signature, username, logo, watermark, blurry, ' +
  'monochrome, old, early, sketch'

function sdxlDefaults(): GenerationParams {
  return {
    width: 1080,
    height: 1920,
    steps: 30,
    hiresSteps: 16,
    cfg: 6,
    samplerName: 'euler_ancestral',
    scheduler: 'normal',
    seed: 0,
    randomSeed: true,
    batchSize: 1,
    denoise: 0.45,
    loras: []
  }
}

function fluxDefaults(): GenerationParams {
  return {
    width: 1024,
    height: 1024,
    steps: 20,
    cfg: 3.5,
    samplerName: 'euler',
    scheduler: 'simple',
    seed: 0,
    randomSeed: true,
    batchSize: 1,
    loras: []
  }
}

/** Un checkpoint entrenado sobre Pony/Illustrious rinde mejor con clip skip -2. */
function guessClipSkip(filename: string): number {
  return /pony|illustrious|noob|anime|nai/i.test(filename) ? -2 : -1
}

export function listRecipes(): Recipe[] {
  const models = listModels()
  const pick = (kind: ModelAsset['kind']): ModelAsset[] => models.filter((m) => m.kind === kind)

  const recipes: Recipe[] = []
  let order = 0

  // --- Una receta por checkpoint SDXL ----------------------------------
  for (const ckpt of pick('checkpoint')) {
    const isSd15 = ckpt.architecture === 'sd15'
    recipes.push({
      id: `sdxl:${ckpt.id}`,
      name: prettyName(ckpt.filename),
      description: isSd15
        ? 'SD 1.5 con dos pasadas: compone chico y refina hasta la resolucion final.'
        : 'SDXL con dos pasadas: compone a 1 MP y refina hasta la resolucion final.',
      // El grafo se arma igual para SD 1.5 y SDXL; lo que cambia es con
      // que LoRAs es compatible, y eso viaja en baseArchitecture.
      architecture: 'sdxl',
      baseArchitecture: isSd15 ? 'sd15' : 'sdxl',
      checkpoint: ckpt.filename,
      clipSkip: guessClipSkip(ckpt.filename),
      defaults: sdxlDefaults(),
      negativeDefault: NEGATIVE_SDXL,
      resolutions: SDXL_RESOLUTIONS,
      builtin: true,
      sortOrder: order++
    })
  }

  // --- FLUX: hace falta el trio unet + codificadores + VAE -------------
  const fluxUnets = pick('diffusion_model').filter((m) => m.architecture === 'flux')
  const encoders = pick('text_encoder')
  const clipL = encoders.find((m) => /clip_l/i.test(m.filename))
  const clipT5 = encoders.find((m) => /t5/i.test(m.filename))
  const vae = pick('vae').find((m) => /ae\.|flux/i.test(m.filename)) ?? pick('vae')[0]

  if (clipL && clipT5 && vae) {
    for (const unet of fluxUnets) {
      const isKontext = /kontext/i.test(unet.filename)

      recipes.push({
        id: `flux:${unet.id}`,
        name: prettyName(unet.filename),
        description: isKontext
          ? 'Edita una imagen por instrucciones y conserva el resto intacto.'
          : 'FLUX en una sola pasada. Lo mas realista que hay instalado.',
        architecture: isKontext ? 'flux-kontext' : 'flux',
        baseArchitecture: 'flux',
        unet: unet.filename,
        clipL: clipL.filename,
        clipT5: clipT5.filename,
        vae: vae.filename,
        weightDtype: /fp8/i.test(unet.filename) ? 'fp8_e4m3fn' : 'default',
        defaults: { ...fluxDefaults(), cfg: isKontext ? 2.5 : 3.5 },
        negativeDefault: '',
        resolutions: isKontext ? [] : FLUX_RESOLUTIONS,
        builtin: true,
        sortOrder: order++
      })
    }
  }

  return recipes
}

export function getRecipe(id: string): Recipe {
  const recipe = listRecipes().find((r) => r.id === id)
  if (!recipe) {
    throw new Error('Esa receta ya no existe. Puede que hayas borrado el modelo que usaba.')
  }
  return recipe
}

/** "skibidimix_v10.safetensors" -> "Skibidimix v10" */
function prettyName(filename: string): string {
  const stem = filename.replace(/\.(safetensors|ckpt|pt|pth|gguf|sft)$/i, '')
  return stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}
