import type { GenerationParams } from '@shared/types'

/**
 * Compatibilidad con filas viejas: antes cada LoRA guardaba un solo
 * "trigger" (string); ahora son "triggers" (string[]) para poder activar
 * mas de una. Sin esto, abrir una conversacion o preset creado antes de
 * este cambio rompe al leer (params.loras[].triggers seria undefined).
 */
export function normalizeParams(raw: GenerationParams): GenerationParams {
  return {
    ...raw,
    loras: (raw.loras ?? []).map((l) => {
      const legacy = l as typeof l & { trigger?: string }
      return {
        ...l,
        triggers: Array.isArray(l.triggers) ? l.triggers : legacy.trigger ? [legacy.trigger] : []
      }
    })
  }
}
