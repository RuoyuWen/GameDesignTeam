export type AgentModuleId =
  | 'pm'
  | 'lead'
  | 'gameplay'
  | 'systems'
  | 'narrative'
  | 'level'
  | 'merger'
  | 'qa'

export type AgentModuleMeta = {
  id: AgentModuleId
  title: string
  subtitle: string
  defaultModel: string
}

export const AGENT_MODULES: AgentModuleMeta[] = [
  {
    id: 'pm',
    title: 'PM（需求与 PRD）',
    subtitle: 'Yoshi-P',
    defaultModel: 'gpt-5.4',
  },
  {
    id: 'lead',
    title: '主策划（架构与任务分发）',
    subtitle: 'Josh Sawyer',
    defaultModel: 'gpt-5.4',
  },
  {
    id: 'gameplay',
    title: '玩法策划',
    subtitle: 'Shigeru Miyamoto',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'systems',
    title: '数值策划',
    subtitle: 'Garfield',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'narrative',
    title: '叙事策划',
    subtitle: 'Amy Hennig',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'level',
    title: '关卡策划',
    subtitle: 'Hidetaka Miyazaki',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'merger',
    title: 'GDD 合并',
    subtitle: '主策划整合',
    defaultModel: 'gpt-5.4',
  },
  {
    id: 'qa',
    title: 'QA 验收',
    subtitle: 'Gabe Newell',
    defaultModel: 'gpt-5.4',
  },
]

export function defaultModelsRecord(): Record<AgentModuleId, string> {
  return Object.fromEntries(
    AGENT_MODULES.map((m) => [m.id, m.defaultModel]),
  ) as Record<AgentModuleId, string>
}
