/**
 * Model IDs aligned with OpenAI API docs (Frontier + catalog).
 * @see https://developers.openai.com/api/docs/models
 */

export type ModelGroup = {
  id: string
  label: string
  description?: string
  models: { id: string; label: string; hint?: string }[]
}

export const OPENAI_MODEL_GROUPS: ModelGroup[] = [
  {
    id: 'frontier',
    label: 'Frontier（文本 / 推理 / 工具）',
    description:
      '官方建议：复杂推理与编码用 gpt-5.4；低延迟与成本用 gpt-5.4-mini 或 gpt-5.4-nano。',
    models: [
      { id: 'gpt-5.4', label: 'GPT-5.4', hint: '旗舰' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', hint: '更强 mini' },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', hint: '高并发低成本' },
    ],
  },
  {
    id: 'image',
    label: '图像生成与编辑',
    models: [
      { id: 'gpt-image-1.5', label: 'GPT Image 1.5' },
      { id: 'gpt-image-1-mini', label: 'GPT Image 1 mini' },
    ],
  },
  {
    id: 'realtime',
    label: 'Realtime 语音',
    models: [
      { id: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5' },
      { id: 'gpt-realtime-mini', label: 'GPT Realtime mini' },
    ],
  },
  {
    id: 'speech',
    label: '语音合成与转写',
    models: [
      { id: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS' },
      { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
      { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini Transcribe' },
    ],
  },
]

const ALL_IDS = new Set(
  OPENAI_MODEL_GROUPS.flatMap((g) => g.models.map((m) => m.id)),
)

export function isCatalogModelId(id: string): boolean {
  return ALL_IDS.has(id)
}

export const CUSTOM_MODEL_SENTINEL = '__custom__'
