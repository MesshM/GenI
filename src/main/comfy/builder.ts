import type { ComfyWorkflow, GenerationParams, Recipe } from '@shared/types'

/**
 * Arma el grafo de ComfyUI desde cero segun la arquitectura elegida.
 *
 * Antes cada preset era un JSON fijo y los parametros se escribian encima. Eso
 * no permitia agregar o quitar LoRAs, porque habria que reconectar enlaces a
 * mano. Generando el grafo aca, la cadena de LoRAs es simplemente un bucle.
 */

/** Contador de nodos: los ids son strings, como espera la API de ComfyUI. */
class NodeBag {
  private next = 1
  readonly nodes: ComfyWorkflow = {}

  add(classType: string, inputs: Record<string, unknown>): string {
    const id = String(this.next++)
    this.nodes[id] = { class_type: classType, inputs }
    return id
  }
}

export interface BuildInput {
  recipe: Recipe
  params: GenerationParams
  prompt: string
  negative: string
  /** Nombre del archivo ya subido a ComfyUI, para los flujos de edicion. */
  inputImageName?: string
}

export function buildWorkflow(input: BuildInput): ComfyWorkflow {
  switch (input.recipe.architecture) {
    case 'sdxl':
      return buildSdxl(input)
    case 'flux':
      return buildFlux(input)
    case 'flux-kontext':
      return buildFluxKontext(input)
    default:
      throw new Error(`Arquitectura no soportada: ${input.recipe.architecture}`)
  }
}

/** Las palabras de activacion de las LoRAs encendidas van al principio del prompt. */
function withTriggers(prompt: string, params: GenerationParams): string {
  const triggers = params.loras
    .filter((l) => l.enabled && l.trigger)
    .map((l) => l.trigger as string)
  return [...triggers, prompt].filter(Boolean).join(', ')
}

/**
 * Encadena un LoraLoader por cada LoRA activa.
 * Devuelve los enlaces de modelo y clip que quedan al final de la cadena.
 */
function chainLoras(
  bag: NodeBag,
  params: GenerationParams,
  model: [string, number],
  clip: [string, number]
): { model: [string, number]; clip: [string, number] } {
  let currentModel = model
  let currentClip = clip

  for (const lora of params.loras) {
    if (!lora.enabled || !lora.filename || lora.strength === 0) continue

    const id = bag.add('LoraLoader', {
      model: currentModel,
      clip: currentClip,
      lora_name: lora.filename,
      strength_model: lora.strength,
      strength_clip: lora.strength
    })
    currentModel = [id, 0]
    currentClip = [id, 1]
  }

  return { model: currentModel, clip: currentClip }
}

/**
 * Mantiene la primera pasada cerca de 1 megapixel.
 * SDXL esta entrenado a esa escala: pedirle 2 MP de una sola vez le hace
 * duplicar personajes y miembros.
 */
export function baseResolution(
  width: number,
  height: number,
  targetPixels = 1_048_576
): { width: number; height: number } {
  const factor = Math.sqrt(targetPixels / (width * height))
  const round64 = (n: number): number => Math.max(512, Math.round(n / 64) * 64)
  return { width: round64(width * factor), height: round64(height * factor) }
}

// ------------------------------------------------------------------ SDXL

function buildSdxl({ recipe, params, prompt, negative }: BuildInput): ComfyWorkflow {
  const bag = new NodeBag()

  if (!recipe.checkpoint) throw new Error('Esta receta no tiene checkpoint elegido')
  const ckpt = bag.add('CheckpointLoaderSimple', { ckpt_name: recipe.checkpoint })

  const chained = chainLoras(bag, params, [ckpt, 0], [ckpt, 1])

  // Los modelos de anime suelen recomendar saltarse la ultima capa de CLIP.
  const clipSource: [string, number] =
    recipe.clipSkip && recipe.clipSkip < -1
      ? [bag.add('CLIPSetLastLayer', { clip: chained.clip, stop_at_clip_layer: recipe.clipSkip }), 0]
      : chained.clip

  const positive = bag.add('CLIPTextEncode', {
    text: withTriggers(prompt, params),
    clip: clipSource
  })
  const negativeNode = bag.add('CLIPTextEncode', { text: negative, clip: clipSource })

  const base = baseResolution(params.width, params.height)
  const latent = bag.add('EmptyLatentImage', {
    width: base.width,
    height: base.height,
    batch_size: params.batchSize
  })

  const sampler = bag.add('KSampler', {
    seed: params.seed,
    steps: params.steps,
    cfg: params.cfg,
    sampler_name: params.samplerName,
    scheduler: params.scheduler,
    denoise: 1.0,
    model: chained.model,
    positive: [positive, 0],
    negative: [negativeNode, 0],
    latent_image: [latent, 0]
  })

  let finalLatent: [string, number] = [sampler, 0]

  // Segunda pasada solo si de verdad hay que escalar.
  const needsHires = params.width * params.height > base.width * base.height * 1.1
  if (needsHires) {
    const upscale = bag.add('LatentUpscale', {
      samples: [sampler, 0],
      upscale_method: 'bislerp',
      width: params.width,
      height: params.height,
      crop: 'disabled'
    })

    const refine = bag.add('KSampler', {
      // Misma seed que la base: si difieren, el refinado reinventa la escena.
      seed: params.seed,
      steps: params.hiresSteps ?? Math.max(8, Math.round(params.steps * 0.55)),
      cfg: params.cfg,
      sampler_name: params.samplerName,
      scheduler: params.scheduler,
      denoise: params.denoise ?? 0.45,
      model: chained.model,
      positive: [positive, 0],
      negative: [negativeNode, 0],
      latent_image: [upscale, 0]
    })
    finalLatent = [refine, 0]
  }

  const decode = bag.add('VAEDecode', { samples: finalLatent, vae: [ckpt, 2] })
  bag.add('SaveImage', { images: [decode, 0], filename_prefix: 'GenI' })

  return bag.nodes
}

// ------------------------------------------------------------------ FLUX

function buildFlux({ recipe, params, prompt }: BuildInput): ComfyWorkflow {
  const bag = new NodeBag()

  if (!recipe.unet) throw new Error('Esta receta no tiene modelo de difusion elegido')
  if (!recipe.clipL || !recipe.clipT5) throw new Error('Faltan los codificadores de texto')
  if (!recipe.vae) throw new Error('Falta el VAE')

  const unet = bag.add('UNETLoader', {
    unet_name: recipe.unet,
    weight_dtype: recipe.weightDtype ?? 'default'
  })
  const clip = bag.add('DualCLIPLoader', {
    clip_name1: recipe.clipL,
    clip_name2: recipe.clipT5,
    type: 'flux'
  })
  const vae = bag.add('VAELoader', { vae_name: recipe.vae })

  const chained = chainLoras(bag, params, [unet, 0], [clip, 0])

  const positive = bag.add('CLIPTextEncode', {
    text: withTriggers(prompt, params),
    clip: chained.clip
  })
  // FLUX se guia con FluxGuidance; el CFG del muestreador queda en 1.
  const guided = bag.add('FluxGuidance', { conditioning: [positive, 0], guidance: params.cfg })
  const empty = bag.add('ConditioningZeroOut', { conditioning: [positive, 0] })

  const latent = bag.add('EmptySD3LatentImage', {
    width: params.width,
    height: params.height,
    batch_size: params.batchSize
  })

  const sampler = bag.add('KSampler', {
    seed: params.seed,
    steps: params.steps,
    cfg: 1.0,
    sampler_name: params.samplerName,
    scheduler: params.scheduler,
    denoise: 1.0,
    model: chained.model,
    positive: [guided, 0],
    negative: [empty, 0],
    latent_image: [latent, 0]
  })

  const decode = bag.add('VAEDecode', { samples: [sampler, 0], vae: [vae, 0] })
  bag.add('SaveImage', { images: [decode, 0], filename_prefix: 'GenI' })

  return bag.nodes
}

// ---------------------------------------------------------- FLUX Kontext

function buildFluxKontext({ recipe, params, prompt, inputImageName }: BuildInput): ComfyWorkflow {
  const bag = new NodeBag()

  if (!inputImageName) throw new Error('Este flujo necesita una imagen de entrada')
  if (!recipe.unet) throw new Error('Esta receta no tiene modelo de difusion elegido')
  if (!recipe.clipL || !recipe.clipT5) throw new Error('Faltan los codificadores de texto')
  if (!recipe.vae) throw new Error('Falta el VAE')

  const unet = bag.add('UNETLoader', {
    unet_name: recipe.unet,
    weight_dtype: recipe.weightDtype ?? 'default'
  })
  const clip = bag.add('DualCLIPLoader', {
    clip_name1: recipe.clipL,
    clip_name2: recipe.clipT5,
    type: 'flux'
  })
  const vae = bag.add('VAELoader', { vae_name: recipe.vae })

  const chained = chainLoras(bag, params, [unet, 0], [clip, 0])

  const image = bag.add('LoadImage', { image: inputImageName })
  // Kontext trabaja con un juego fijo de resoluciones; este nodo ajusta.
  const scaled = bag.add('FluxKontextImageScale', { image: [image, 0] })
  const encoded = bag.add('VAEEncode', { pixels: [scaled, 0], vae: [vae, 0] })

  const positive = bag.add('CLIPTextEncode', {
    text: withTriggers(prompt, params),
    clip: chained.clip
  })
  // ReferenceLatent es lo que hace que conserve la imagen original.
  const reference = bag.add('ReferenceLatent', {
    conditioning: [positive, 0],
    latent: [encoded, 0]
  })
  const guided = bag.add('FluxGuidance', { conditioning: [reference, 0], guidance: params.cfg })
  const empty = bag.add('ConditioningZeroOut', { conditioning: [positive, 0] })

  const sampler = bag.add('KSampler', {
    seed: params.seed,
    steps: params.steps,
    cfg: 1.0,
    sampler_name: params.samplerName,
    scheduler: params.scheduler,
    denoise: 1.0,
    model: chained.model,
    positive: [guided, 0],
    negative: [empty, 0],
    latent_image: [encoded, 0]
  })

  const decode = bag.add('VAEDecode', { samples: [sampler, 0], vae: [vae, 0] })
  bag.add('SaveImage', { images: [decode, 0], filename_prefix: 'GenI' })

  return bag.nodes
}
