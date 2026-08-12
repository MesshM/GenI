import type {
  ComfyWorkflow,
  GenerationParams,
  NodeTarget,
  ParamMap,
  Preset
} from '@shared/types'

/**
 * Toma el workflow plantilla del preset y le escribe los valores elegidos en la
 * interfaz, guiandose por el mapa de parametros.
 *
 * La plantilla nunca se modifica: se clona antes de tocar nada, asi el preset
 * sigue limpio para la proxima generacion.
 */
export function buildWorkflow(
  preset: Preset,
  params: GenerationParams,
  prompt: string,
  negative: string,
  inputImageName?: string
): ComfyWorkflow {
  const wf: ComfyWorkflow = structuredClone(preset.workflow)
  const map = preset.paramMap

  const write = (targets: NodeTarget[] | undefined, value: unknown): void => {
    if (!targets) return
    for (const t of targets) {
      const node = wf[t.node]
      if (!node) {
        // El preset y su mapa no coinciden: mejor fallar claro que generar mal.
        throw new Error(`El preset "${preset.name}" apunta al nodo ${t.node}, que no existe`)
      }
      node.inputs[t.input] = value
    }
  }

  // Los triggers de las LoRAs activas se anteponen al prompt: sin esa palabra
  // la LoRA carga pero casi no se nota.
  const triggers = params.loras
    .filter((l) => l.enabled && l.trigger)
    .map((l) => l.trigger as string)

  const fullPrompt = [...triggers, prompt].filter(Boolean).join(', ')

  write(map.positive, fullPrompt)
  write(map.negative, negative)
  write(map.steps, params.steps)
  write(map.cfg, params.cfg)
  write(map.samplerName, params.samplerName)
  write(map.scheduler, params.scheduler)
  write(map.seed, params.seed)
  write(map.batchSize, params.batchSize)
  if (params.denoise !== undefined) write(map.denoise, params.denoise)

  // Resolucion final del hires fix.
  write(map.width, params.width)
  write(map.height, params.height)

  // La pasada base se mantiene cerca de 1 megapixel: pedirle a SDXL 2 MP de una
  // sola vez le hace duplicar personajes y miembros.
  const base = baseResolution(params.width, params.height)
  write(map.baseWidth, base.width)
  write(map.baseHeight, base.height)

  if (inputImageName) write(map.inputImage, inputImageName)

  applyLoras(wf, map, params)
  return wf
}

/**
 * Escala la resolucion pedida hasta rondar 1 megapixel, respetando la relacion
 * de aspecto y redondeando a multiplos de 64 (lo que espera el VAE de SDXL).
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

/**
 * Ajusta la fuerza de cada LoRA. Desactivarla se hace poniendola en 0 en vez de
 * sacar el nodo del grafo: mantener la forma del workflow evita reconectar
 * enlaces y que se rompa la cadena model/clip.
 */
function applyLoras(wf: ComfyWorkflow, map: ParamMap, params: GenerationParams): void {
  if (!map.loras) return

  for (const slot of map.loras) {
    const node = wf[slot.node]
    if (!node) continue

    const setting = params.loras.find((l) => l.node === slot.node)
    const strength = setting && setting.enabled ? setting.strength : 0

    node.inputs.strength_model = strength
    node.inputs.strength_clip = strength
  }
}

/** Seed aleatoria dentro del rango que acepta ComfyUI. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}
