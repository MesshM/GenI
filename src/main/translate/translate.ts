import { app } from 'electron'
import { join } from 'node:path'

/**
 * Traductor local ES->EN (Helsinki-NLP/opus-mt-es-en, via transformers.js).
 * Corre en CPU dentro del proceso principal, nada sale de la maquina.
 * El modelo (~300MB) se descarga una sola vez y queda cacheado en userData;
 * el pipeline se arma perezoso porque cargarlo tarda y no todos usan el
 * traductor en cada sesion.
 */

let pipelinePromise: Promise<(text: string) => Promise<string>> | null = null

async function loadPipeline(): Promise<(text: string) => Promise<string>> {
  const { pipeline, env } = await import('@huggingface/transformers')

  env.cacheDir = join(app.getPath('userData'), 'translate-cache')
  env.allowLocalModels = false

  const translator = await pipeline('translation', 'Xenova/opus-mt-es-en')

  return async (text: string) => {
    const output = await translator(text, {})
    const first = Array.isArray(output) ? output[0] : output
    return String((first as { translation_text?: string }).translation_text ?? '').trim()
  }
}

export async function translateEsToEn(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''

  pipelinePromise ??= loadPipeline()
  const translate = await pipelinePromise
  return translate(trimmed)
}
