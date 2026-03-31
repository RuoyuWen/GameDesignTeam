import type { AgentModuleId } from '../data/agentModules'
import { defaultModelsRecord } from '../data/agentModules'
import { STORAGE_KEY_API, STORAGE_KEY_MODELS } from './configKeys'

export function loadApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_API) ?? ''
  } catch {
    return ''
  }
}

export function loadModels(): Record<AgentModuleId, string> {
  const base = defaultModelsRecord()
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MODELS)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Record<AgentModuleId, string>>
    return { ...base, ...parsed }
  } catch {
    return base
  }
}
