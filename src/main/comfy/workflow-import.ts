import { readFile } from 'node:fs/promises'
import { listModels } from '../models/manager'
import type { ComfyWorkflow, WorkflowRequirement, WorkflowReport, ModelKind } from '@shared/types'

/**
 * Lee un workflow exportado de ComfyUI y dice que hace falta para correrlo.
 *
 * ComfyUI exporta en dos formatos: el de la interfaz (con `nodes` como
 * lista, que es lo que sale del boton "Save") y el de la API (un objeto
 * id -> nodo, del boton "Save (API format)"). Solo el segundo se puede
 * mandar a /prompt, asi que si llega el primero se convierte.
 *
 * Los nombres de archivo que pide el workflow salen de los campos de
 * entrada de los nodos de carga; cada tipo de nodo dice que clase de
 * modelo espera, y con eso se sabe en que carpeta tendria que estar.
 */

/** Que nodo pide que clase de modelo, y en que campo viene el nombre. */
const LOADERS: Record<string, { field: string; kind: ModelKind }> = {
  CheckpointLoaderSimple: { field: 'ckpt_name', kind: 'checkpoint' },
  CheckpointLoader: { field: 'ckpt_name', kind: 'checkpoint' },
  ImageOnlyCheckpointLoader: { field: 'ckpt_name', kind: 'checkpoint' },
  LoraLoader: { field: 'lora_name', kind: 'lora' },
  LoraLoaderModelOnly: { field: 'lora_name', kind: 'lora' },
  VAELoader: { field: 'vae_name', kind: 'vae' },
  UNETLoader: { field: 'unet_name', kind: 'diffusion_model' },
  ControlNetLoader: { field: 'control_net_name', kind: 'controlnet' },
  DiffControlNetLoader: { field: 'control_net_name', kind: 'controlnet' },
  UpscaleModelLoader: { field: 'model_name', kind: 'upscale_model' },
  CLIPLoader: { field: 'clip_name', kind: 'text_encoder' },
  StyleModelLoader: { field: 'style_model_name', kind: 'unknown' },
  GLIGENLoader: { field: 'gligen_name', kind: 'unknown' }
}

/** DualCLIPLoader y TripleCLIPLoader piden varios codificadores a la vez. */
const MULTI_CLIP: Record<string, string[]> = {
  DualCLIPLoader: ['clip_name1', 'clip_name2'],
  TripleCLIPLoader: ['clip_name1', 'clip_name2', 'clip_name3'],
  QuadrupleCLIPLoader: ['clip_name1', 'clip_name2', 'clip_name3', 'clip_name4']
}

interface UiNode {
  type?: string
  widgets_values?: unknown[]
  inputs?: unknown
}

/**
 * Normaliza al formato de API. El de la interfaz guarda los valores de los
 * widgets en un array posicional, sin nombres, asi que no se puede mapear
 * campo por campo de forma fiable: para esos se leen todos los valores que
 * parezcan nombres de archivo de modelo.
 */
export function toApiFormat(raw: unknown): { workflow: ComfyWorkflow | null; uiNodes: UiNode[] } {
  const data = raw as Record<string, unknown>

  if (Array.isArray(data.nodes)) {
    return { workflow: null, uiNodes: data.nodes as UiNode[] }
  }

  // Formato API: todos los valores tienen class_type.
  const entries = Object.entries(data).filter(
    ([, v]) => v && typeof v === 'object' && 'class_type' in (v as object)
  )
  if (entries.length === 0) return { workflow: null, uiNodes: [] }

  return { workflow: Object.fromEntries(entries) as ComfyWorkflow, uiNodes: [] }
}

const MODEL_FILE = /\.(safetensors|ckpt|pt|pth|gguf|sft|bin)$/i

/** Que modelos pide el workflow, y cuales de esos ya estan instalados. */
export async function inspectWorkflowFile(path: string): Promise<WorkflowReport> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new Error('Ese archivo no es un JSON valido')
  }

  const { workflow, uiNodes } = toApiFormat(parsed)
  if (!workflow && uiNodes.length === 0) {
    throw new Error('No parece un workflow de ComfyUI')
  }

  const wanted = new Map<string, ModelKind>()

  if (workflow) {
    for (const node of Object.values(workflow)) {
      const single = LOADERS[node.class_type]
      if (single) {
        const value = node.inputs?.[single.field]
        if (typeof value === 'string' && value) wanted.set(value, single.kind)
      }

      const multi = MULTI_CLIP[node.class_type]
      if (multi) {
        for (const field of multi) {
          const value = node.inputs?.[field]
          if (typeof value === 'string' && value) wanted.set(value, 'text_encoder')
        }
      }
    }
  } else {
    // Formato de interfaz: sin nombres de campo, se rescata por extension.
    for (const node of uiNodes) {
      const kind = node.type ? (LOADERS[node.type]?.kind ?? 'unknown') : 'unknown'
      for (const value of node.widgets_values ?? []) {
        if (typeof value === 'string' && MODEL_FILE.test(value)) wanted.set(value, kind)
      }
    }
  }

  const installed = listModels()
  const requirements: WorkflowRequirement[] = [...wanted.entries()].map(([filename, kind]) => {
    // ComfyUI acepta subcarpetas en el nombre ("SDXL/modelo.safetensors"),
    // asi que se compara solo la ultima parte.
    const base = filename.split(/[\\/]/).pop() as string
    const found = installed.find((m) => m.filename === base)
    return {
      filename: base,
      kind: found?.kind ?? kind,
      installed: Boolean(found)
    }
  })

  return {
    apiFormat: Boolean(workflow),
    nodeCount: workflow ? Object.keys(workflow).length : uiNodes.length,
    requirements,
    workflow: workflow ?? null
  }
}
