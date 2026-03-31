import { useCallback, useMemo, useState } from 'react'
import {
  AGENT_MODULES,
  type AgentModuleId,
  defaultModelsRecord,
} from '../data/agentModules'
import {
  CUSTOM_MODEL_SENTINEL,
  OPENAI_MODEL_GROUPS,
  isCatalogModelId,
} from '../data/openaiModels'
import { STORAGE_KEY_API, STORAGE_KEY_MODELS } from '../lib/configKeys'
import '../App.css'

type RowState = {
  selectValue: string
  customValue: string
}

function modelToRowState(modelId: string): RowState {
  if (isCatalogModelId(modelId)) {
    return { selectValue: modelId, customValue: '' }
  }
  return { selectValue: CUSTOM_MODEL_SENTINEL, customValue: modelId }
}

function rowStateToModel(row: RowState): string {
  if (row.selectValue === CUSTOM_MODEL_SENTINEL) {
    return row.customValue.trim() || 'gpt-5.4'
  }
  return row.selectValue
}

function loadStoredModels(): Record<AgentModuleId, string> {
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

export default function ConfigPage() {
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_API) ?? ''
    } catch {
      return ''
    }
  })
  const [showKey, setShowKey] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [rows, setRows] = useState<Record<AgentModuleId, RowState>>(() => {
    const m = loadStoredModels()
    return Object.fromEntries(
      AGENT_MODULES.map((mod) => [mod.id, modelToRowState(m[mod.id])]),
    ) as Record<AgentModuleId, RowState>
  })

  const setRow = useCallback(
    (id: AgentModuleId, patch: Partial<RowState>) => {
      setRows((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }))
    },
    [],
  )

  const modelsPayload = useMemo(() => {
    const out = {} as Record<AgentModuleId, string>
    for (const mod of AGENT_MODULES) {
      out[mod.id] = rowStateToModel(rows[mod.id])
    }
    return out
  }, [rows])

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY_API, apiKey.trim())
      localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(modelsPayload))
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
    } catch {
      /* ignore */
    }
  }, [apiKey, modelsPayload])

  const applyPreset = useCallback(
    (kind: 'flagship' | 'balanced' | 'economy') => {
      const next: Record<AgentModuleId, string> = { ...defaultModelsRecord() }
      if (kind === 'flagship') {
        for (const m of AGENT_MODULES) next[m.id] = 'gpt-5.4'
      } else if (kind === 'balanced') {
        for (const m of AGENT_MODULES) {
          if (['pm', 'lead', 'merger', 'qa'].includes(m.id)) next[m.id] = 'gpt-5.4'
          else next[m.id] = 'gpt-5.4-mini'
        }
      } else {
        for (const m of AGENT_MODULES) {
          if (['pm', 'lead', 'merger', 'qa'].includes(m.id))
            next[m.id] = 'gpt-5.4-mini'
          else next[m.id] = 'gpt-5.4-nano'
        }
      }
      setRows(
        Object.fromEntries(
          AGENT_MODULES.map((mod) => [
            mod.id,
            modelToRowState(next[mod.id]),
          ]),
        ) as Record<AgentModuleId, RowState>,
      )
    },
    [],
  )

  const resetDefaults = useCallback(() => {
    const d = defaultModelsRecord()
    setRows(
      Object.fromEntries(
        AGENT_MODULES.map((mod) => [mod.id, modelToRowState(d[mod.id])]),
      ) as Record<AgentModuleId, RowState>,
    )
  }, [])

  return (
    <div className="config-page">
      <header className="config-header">
        <p className="config-kicker">多智能体游戏设计管线</p>
        <h1 className="config-title">连接与模型配置</h1>
        <p className="config-lead">
          填写 OpenAI API Key，并为各模块选择{' '}
          <a
            href="https://developers.openai.com/api/docs/models"
            target="_blank"
            rel="noreferrer"
          >
            官方模型目录
          </a>
          中的模型 ID。保存后可在「工作台」调用真实 API。开发时需同时启动 Vite 与本地 API 服务（见终端）。
        </p>
      </header>

      <section className="card">
        <h2 className="card-title">API Key</h2>
        <p className="card-hint">
          密钥经本地代理转发至 OpenAI，不会写入仓库。请勿将 Key 提交到 Git。
        </p>
        <div className="field-row">
          <div className="input-wrap key-wrap">
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              aria-label="OpenAI API Key"
            />
            <button
              type="button"
              className="btn ghost btn-toggle"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">各模块模型</h2>
          <div className="preset-bar">
            <span className="preset-label">快速预设：</span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => applyPreset('flagship')}
            >
              全旗舰 gpt-5.4
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => applyPreset('balanced')}
            >
              平衡（主链 5.4 / 子模块 mini）
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => applyPreset('economy')}
            >
              经济（主链 mini / 子模块 nano）
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={resetDefaults}
            >
              恢复默认
            </button>
          </div>
        </div>

        <ul className="module-list">
          {AGENT_MODULES.map((mod) => {
            const row = rows[mod.id]
            const showCustom = row.selectValue === CUSTOM_MODEL_SENTINEL
            return (
              <li key={mod.id} className="module-row">
                <div className="module-info">
                  <span className="module-title">{mod.title}</span>
                  <span className="module-sub">{mod.subtitle}</span>
                </div>
                <div className="module-controls">
                  <select
                    className="select"
                    value={row.selectValue}
                    onChange={(e) =>
                      setRow(mod.id, {
                        selectValue: e.target.value,
                        customValue:
                          e.target.value === CUSTOM_MODEL_SENTINEL
                            ? row.customValue
                            : '',
                      })
                    }
                    aria-label={`${mod.title} 模型`}
                  >
                    {OPENAI_MODEL_GROUPS.map((g) => (
                      <optgroup key={g.id} label={g.label}>
                        {g.models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                            {m.hint ? ` — ${m.hint}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value={CUSTOM_MODEL_SENTINEL}>自定义模型 ID…</option>
                  </select>
                  {showCustom && (
                    <input
                      className="input input-custom"
                      type="text"
                      spellCheck={false}
                      placeholder="例如 o4-mini 或自建别名"
                      value={row.customValue}
                      onChange={(e) =>
                        setRow(mod.id, { customValue: e.target.value })
                      }
                      aria-label={`${mod.title} 自定义模型 ID`}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="actions">
        <button type="button" className="btn primary" onClick={handleSave}>
          保存配置
        </button>
        {savedFlash && (
          <span className="saved-toast" role="status">
            已保存
          </span>
        )}
      </div>

      <footer className="config-footer">
        <p>
          本地键名：<code>{STORAGE_KEY_API}</code>、
          <code>{STORAGE_KEY_MODELS}</code>
        </p>
      </footer>
    </div>
  )
}
