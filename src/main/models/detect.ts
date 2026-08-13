import { open } from 'node:fs/promises'
import { basename } from 'node:path'
import type { ModelArchitecture, ModelKind } from '@shared/types'

/**
 * Un archivo .safetensors empieza con:
 *   8 bytes  -> largo de la cabecera (entero de 64 bits, little endian)
 *   N bytes  -> cabecera JSON con los nombres de tensores y __metadata__
 *
 * Con eso alcanza para saber que es el archivo sin leer los gigabytes de pesos.
 */
const MAX_HEADER_BYTES = 32 * 1024 * 1024

export interface SafetensorsHeader {
  tensorNames: string[]
  metadata: Record<string, string>
}

export async function readSafetensorsHeader(path: string): Promise<SafetensorsHeader | null> {
  let handle
  try {
    handle = await open(path, 'r')

    const lenBuf = Buffer.alloc(8)
    const { bytesRead } = await handle.read(lenBuf, 0, 8, 0)
    if (bytesRead < 8) return null

    const headerLen = Number(lenBuf.readBigUInt64LE(0))
    if (!Number.isFinite(headerLen) || headerLen <= 0 || headerLen > MAX_HEADER_BYTES) return null

    const jsonBuf = Buffer.alloc(headerLen)
    await handle.read(jsonBuf, 0, headerLen, 8)

    const parsed = JSON.parse(jsonBuf.toString('utf8')) as Record<string, unknown>
    const metadata = (parsed.__metadata__ ?? {}) as Record<string, string>

    return {
      tensorNames: Object.keys(parsed).filter((k) => k !== '__metadata__'),
      metadata
    }
  } catch {
    return null
  } finally {
    await handle?.close()
  }
}

export interface DetectionResult {
  kind: ModelKind
  architecture: ModelArchitecture
  /** Palabras que activan la LoRA, si el archivo las declara. */
  triggerWords: string[]
  /** Como se llego a la conclusion, para mostrarlo en la interfaz. */
  reason: string
}

/**
 * Clasifica un modelo mirando los nombres de sus tensores.
 *
 * El orden importa: se comprueba primero LoRA, porque una LoRA de un checkpoint
 * SDXL contiene nombres que tambien aparecen en el checkpoint completo.
 */
export function classify(header: SafetensorsHeader, filename: string): DetectionResult {
  const names = header.tensorNames
  const meta = header.metadata
  const has = (pattern: string): boolean => names.some((n) => n.includes(pattern))
  const triggerWords = extractTriggerWords(meta)

  // --- LoRA -------------------------------------------------------------
  // Los entrenadores dejan rastro en __metadata__ y en el nombre de los pesos.
  if (
    meta.ss_network_module ||
    has('lora_unet_') ||
    has('lora_te_') ||
    has('.lora_A.') ||
    has('.lora_B.') ||
    has('.lora_down.') ||
    has('.lora_up.')
  ) {
    return {
      kind: 'lora',
      architecture: loraArchitecture(names, meta),
      triggerWords,
      reason: meta.ss_network_module
        ? `entrenada con ${meta.ss_network_module}`
        : 'tensores lora_up/lora_down'
    }
  }

  // --- FLUX -------------------------------------------------------------
  // El transformer de FLUX se organiza en bloques dobles y simples.
  if (has('double_blocks.') || has('single_blocks.')) {
    return {
      kind: 'diffusion_model',
      architecture: 'flux',
      triggerWords,
      reason: 'bloques double/single de FLUX'
    }
  }

  // --- VAE --------------------------------------------------------------
  // Un VAE suelto solo tiene encoder/decoder y ningun bloque de difusion.
  if ((has('encoder.down.') || has('decoder.up.')) && !has('model.diffusion_model.')) {
    return { kind: 'vae', architecture: 'unknown', triggerWords, reason: 'solo encoder/decoder' }
  }

  // --- Codificadores de texto ------------------------------------------
  if (has('text_model.encoder.layers') && !has('model.diffusion_model.')) {
    return { kind: 'text_encoder', architecture: 'unknown', triggerWords, reason: 'CLIP suelto' }
  }
  if (has('encoder.block.') && has('shared.weight')) {
    return { kind: 'text_encoder', architecture: 'unknown', triggerWords, reason: 'T5' }
  }

  // --- ControlNet -------------------------------------------------------
  if (has('control_model.') || has('input_hint_block.')) {
    return { kind: 'controlnet', architecture: 'unknown', triggerWords, reason: 'bloques de control' }
  }

  // --- Checkpoints completos -------------------------------------------
  if (has('model.diffusion_model.')) {
    // SDXL trae dos codificadores de texto bajo conditioner.embedders;
    // SD 1.5 trae uno solo bajo cond_stage_model.
    const architecture: ModelArchitecture = has('conditioner.embedders.1')
      ? 'sdxl'
      : has('conditioner.embedders.')
        ? 'sdxl'
        : 'sd15'
    return {
      kind: 'checkpoint',
      architecture,
      triggerWords,
      reason: architecture === 'sdxl' ? 'UNet + dos codificadores' : 'UNet + un codificador'
    }
  }

  // --- Embedding / inversion textual -----------------------------------
  if (names.length <= 4 && (has('emb_params') || has('string_to_param'))) {
    return { kind: 'embedding', architecture: 'unknown', triggerWords, reason: 'inversion textual' }
  }

  // --- Modelo de escalado ----------------------------------------------
  if (has('body.') && has('conv_first.')) {
    return { kind: 'upscale_model', architecture: 'unknown', triggerWords, reason: 'ESRGAN' }
  }

  // --- Ultimo recurso: el nombre del archivo ----------------------------
  // Arquitecturas nuevas (Qwen-Image, y las que vengan) usan sus propios
  // nombres de tensor, distintos a los de SD/SDXL/FLUX que reconocen los
  // bloques de arriba. Sin esto un VAE o codificador de una arquitectura
  // asi cae en "no reconocido" y termina mal ubicado (carpeta checkpoints).
  const lower = basename(filename).toLowerCase()
  if (lower.includes('vae')) {
    return {
      kind: 'vae',
      architecture: 'unknown',
      triggerWords,
      reason: 'no reconocido por tensores; el nombre del archivo sugiere VAE'
    }
  }
  if (lower.includes('text_encoder') || lower.includes('clip') || lower.includes('_t5')) {
    return {
      kind: 'text_encoder',
      architecture: 'unknown',
      triggerWords,
      reason: 'no reconocido por tensores; el nombre del archivo sugiere codificador de texto'
    }
  }
  if (lower.includes('unet') || lower.includes('diffusion_model')) {
    return {
      kind: 'diffusion_model',
      architecture: 'unknown',
      triggerWords,
      reason: 'no reconocido por tensores; el nombre del archivo sugiere modelo de difusion'
    }
  }

  return {
    kind: 'unknown',
    architecture: 'unknown',
    triggerWords,
    reason: `no reconocido (${names.length} tensores, ${basename(filename)})`
  }
}

/** La arquitectura base de una LoRA sale de sus metadatos o de sus dimensiones. */
function loraArchitecture(names: string[], meta: Record<string, string>): ModelArchitecture {
  const declared = `${meta.ss_base_model_version ?? ''} ${meta['modelspec.architecture'] ?? ''}`.toLowerCase()

  if (declared.includes('flux')) return 'flux'
  if (declared.includes('xl') || declared.includes('illustrious') || declared.includes('pony')) {
    return 'sdxl'
  }
  if (declared.includes('sd_v1') || declared.includes('sd1')) return 'sd15'

  // Sin metadatos: las LoRAs de SDXL tocan los dos codificadores de texto.
  if (names.some((n) => n.includes('lora_te2_'))) return 'sdxl'
  if (names.some((n) => n.includes('double_blocks') || n.includes('single_blocks'))) return 'flux'
  return 'unknown'
}

/**
 * Las palabras de activacion vienen en distintos campos segun quien entreno.
 * Se recogen todas y se deduplican.
 */
function extractTriggerWords(meta: Record<string, string>): string[] {
  const words = new Set<string>()

  const direct = meta['modelspec.trigger_phrase'] ?? meta.ss_trigger_words
  if (direct) {
    for (const w of direct.split(',')) {
      const clean = w.trim()
      if (clean) words.add(clean)
    }
  }

  // Kohya guarda las frecuencias de etiquetas por carpeta de entrenamiento;
  // las mas repetidas suelen ser el disparador.
  if (meta.ss_tag_frequency) {
    try {
      const freq = JSON.parse(meta.ss_tag_frequency) as Record<string, Record<string, number>>
      const totals = new Map<string, number>()
      for (const group of Object.values(freq)) {
        for (const [tag, count] of Object.entries(group)) {
          totals.set(tag, (totals.get(tag) ?? 0) + count)
        }
      }
      // Antes se tomaban solo las 3 mas frecuentes; Civitai y la comunidad
      // muestran bastantes mas por LoRA, asi que se amplia la cosecha.
      const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
      for (const [tag] of top) {
        const clean = tag.trim()
        if (clean && clean.length < 40) words.add(clean)
      }
    } catch {
      // metadatos rotos: no es motivo para fallar la importacion
    }
  }

  return [...words].slice(0, 20)
}

/** Carpeta de ComfyUI que corresponde a cada tipo. */
export const FOLDER_BY_KIND: Record<ModelKind, string> = {
  checkpoint: 'checkpoints',
  lora: 'loras',
  vae: 'vae',
  text_encoder: 'text_encoders',
  diffusion_model: 'diffusion_models',
  controlnet: 'controlnet',
  embedding: 'embeddings',
  upscale_model: 'upscale_models',
  unknown: 'checkpoints'
}

export const KIND_LABEL: Record<ModelKind, string> = {
  checkpoint: 'Checkpoint',
  lora: 'LoRA',
  vae: 'VAE',
  text_encoder: 'Codificador de texto',
  diffusion_model: 'Modelo de difusion',
  controlnet: 'ControlNet',
  embedding: 'Embedding',
  upscale_model: 'Escalador',
  unknown: 'Desconocido'
}
