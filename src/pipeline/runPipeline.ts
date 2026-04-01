import type { AgentModuleId } from '../data/agentModules'
import { chatCompletion, type ChatMessage } from '../lib/api'
import {
  GAMEPLAY_SYSTEM,
  LEVEL_SYSTEM,
  NARRATIVE_SYSTEM,
  SYSTEMS_SYSTEM,
  leadRevisionSystem,
  leadSystem,
  mergerSystem,
  mergerUser,
  PM_USER_FINALIZE_PRD,
  qaSystem,
  QA_USER_WRAPPER,
} from '../../shared/prompts.ts'

export type { ChatMessage } from '../lib/api'

export async function pmFinalizePrd(
  apiKey: string,
  model: string,
  pmMessages: ChatMessage[],
): Promise<string> {
  const messages: ChatMessage[] = [
    ...pmMessages,
    { role: 'user', content: PM_USER_FINALIZE_PRD },
  ]
  return chatCompletion({ apiKey, model, messages })
}

export async function runLead(
  apiKey: string,
  model: string,
  prd: string,
  qaContext?: { priorLead: string; feedback: string },
): Promise<string> {
  const system = qaContext
    ? leadRevisionSystem(prd, qaContext.priorLead, qaContext.feedback)
    : leadSystem(prd)
  return chatCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content:
          '请输出任务分发清单与 GDD 骨架。若处于修订轮次，请显式说明相对上一版的变化。',
      },
    ],
  })
}

export async function runAllSubs(
  apiKey: string,
  models: Record<AgentModuleId, string>,
  leadOutput: string,
  revision?: {
    prior?: {
      gameplay?: string
      systems?: string
      narrative?: string
      level?: string
    }
    feedback?: {
      gameplay?: string
      systems?: string
      narrative?: string
      level?: string
    }
  },
): Promise<{
  gameplay: string
  systems: string
  narrative: string
  level: string
}> {
  const task = `主策划任务书如下：\n\n${leadOutput}`
  const subTask = (
    roleLabel: '玩法' | '数值' | '叙事' | '关卡',
    prior?: string,
    feedback?: string,
  ) => {
    if (!feedback?.trim()) return task
    return `${task}

你当前处于修订轮次。请仅根据以下「${roleLabel}模块 QA 修订意见」在上一版基础上迭代，不要改动其他模块职责范围。

## 上一版输出
${prior?.trim() || '（无可用上一版）'}

## ${roleLabel}模块 QA 修订意见（仅供本模块）
${feedback.trim()}

请输出完整修订版，并在开头用 3-5 条要点列出“相对上一版改了什么”。`
  }

  const [gameplay, systems, narrative, level] = await Promise.all([
    chatCompletion({
      apiKey,
      model: models.gameplay,
      messages: [
        { role: 'system', content: GAMEPLAY_SYSTEM },
        {
          role: 'user',
          content: subTask(
            '玩法',
            revision?.prior?.gameplay,
            revision?.feedback?.gameplay,
          ),
        },
      ],
    }),
    chatCompletion({
      apiKey,
      model: models.systems,
      messages: [
        { role: 'system', content: SYSTEMS_SYSTEM },
        {
          role: 'user',
          content: subTask(
            '数值',
            revision?.prior?.systems,
            revision?.feedback?.systems,
          ),
        },
      ],
    }),
    chatCompletion({
      apiKey,
      model: models.narrative,
      messages: [
        { role: 'system', content: NARRATIVE_SYSTEM },
        {
          role: 'user',
          content: subTask(
            '叙事',
            revision?.prior?.narrative,
            revision?.feedback?.narrative,
          ),
        },
      ],
    }),
    chatCompletion({
      apiKey,
      model: models.level,
      messages: [
        { role: 'system', content: LEVEL_SYSTEM },
        {
          role: 'user',
          content: subTask('关卡', revision?.prior?.level, revision?.feedback?.level),
        },
      ],
    }),
  ])
  return { gameplay, systems, narrative, level }
}

export async function runMerge(
  apiKey: string,
  model: string,
  payload: Parameters<typeof mergerUser>[0],
): Promise<string> {
  return chatCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: mergerSystem() },
      { role: 'user', content: mergerUser(payload) },
    ],
  })
}

export async function runQa(
  apiKey: string,
  model: string,
  acceptanceBlock: string,
  gdd: string,
): Promise<string> {
  return chatCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: qaSystem(acceptanceBlock) },
      { role: 'user', content: QA_USER_WRAPPER + gdd },
    ],
    temperature: 0.35,
  })
}
