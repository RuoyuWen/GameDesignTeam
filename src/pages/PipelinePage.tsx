import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentModuleId } from '../data/agentModules'
import { chatCompletion, type ChatMessage } from '../lib/api'
import { loadApiKey, loadModels } from '../lib/storage'
import {
  extractAcceptanceCriteria,
  parseQaDecision,
  parseQaRevisionFeedback,
  parseQaTotalScore,
} from '../pipeline/parse'
import {
  pmFinalizePrd,
  runAllSubs,
  runLead,
  runMerge,
  runQa,
} from '../pipeline/runPipeline'
import { PM_SYSTEM, PM_USER_FINALIZE_PRD } from '../../shared/prompts.ts'
import './PipelinePage.css'

const MAX_QA_ITERATIONS = 3
const QA_PASS_SCORE = 70
function isQaPassed(
  score: number | null,
  decision: 'pass' | 'reject' | null,
): boolean {
  // Product rule: score >= pass threshold always passes.
  if (score !== null && score >= QA_PASS_SCORE) return true
  return decision === 'pass'
}

export default function PipelinePage() {
  const [apiKey, setApiKey] = useState(() => loadApiKey())
  const [models, setModels] = useState<Record<AgentModuleId, string> | null>(
    () => loadModels(),
  )

  const [pmInput, setPmInput] = useState('')
  const [pmMessages, setPmMessages] = useState<ChatMessage[]>(() => [
    { role: 'system', content: PM_SYSTEM },
  ])

  const [prd, setPrd] = useState<string | null>(null)
  const [leadOut, setLeadOut] = useState<string | null>(null)
  const [subs, setSubs] = useState<{
    gameplay: string
    systems: string
    narrative: string
    level: string
  } | null>(null)
  const [mergedGdd, setMergedGdd] = useState<string | null>(null)
  const [qaOut, setQaOut] = useState<string | null>(null)
  const [qaScore, setQaScore] = useState<number | null>(null)
  const [qaDecision, setQaDecision] = useState<'pass' | 'reject' | null>(null)
  const [qaApproved, setQaApproved] = useState(false)
  /** 在首次 QA 之后进行的修订轮数（总 QA 次数 ≤ MAX_QA_ITERATIONS）。 */
  const [qaRevisionCount, setQaRevisionCount] = useState(0)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** PM 阶段短提示（如生成 PRD） */
  const [pmStatus, setPmStatus] = useState<string | null>(null)
  /** 一键管线 / 手动修订时的步骤反馈 */
  const [pipelineRun, setPipelineRun] = useState<{
    completed: string[]
    current: string
    status: 'running' | 'done' | 'error'
    errorMessage?: string
  } | null>(null)

  const pipelineProgressRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (pipelineRun?.status === 'running' && pipelineProgressRef.current) {
      pipelineProgressRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [pipelineRun])

  const refreshConfig = useCallback(() => {
    setApiKey(loadApiKey())
    setModels(loadModels())
  }, [])

  const guard = useCallback(() => {
    if (!apiKey.trim()) {
      setError('请先在「API 与模型」中填写并保存 API Key。')
      return false
    }
    if (!models) {
      setError('无法读取模型配置。')
      return false
    }
    setError(null)
    return true
  }, [apiKey, models])

  const sendPm = useCallback(async () => {
    if (!guard() || !models) return
    const text = pmInput.trim()
    if (!text) return
    setPmInput('')
    setBusy(true)
    setError(null)
    try {
      const nextMsgs: ChatMessage[] = [
        ...pmMessages,
        { role: 'user', content: text },
      ]
      const reply = await chatCompletion({
        apiKey,
        model: models.pm,
        messages: nextMsgs,
      })
      setPmMessages([
        ...nextMsgs,
        { role: 'assistant', content: reply },
      ])
    } catch (e) {
      setPmInput(text)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiKey, guard, models, pmInput, pmMessages])

  const finalizePrd = useCallback(async () => {
    if (!guard() || !models) return
    setBusy(true)
    setPmStatus('正在生成 PRD，请稍候…')
    setError(null)
    try {
      const text = await pmFinalizePrd(apiKey, models.pm, pmMessages)
      setPmMessages((m) => [
        ...m,
        { role: 'user', content: PM_USER_FINALIZE_PRD },
        { role: 'assistant', content: text },
      ])
      setPrd(text)
      setLeadOut(null)
      setSubs(null)
      setMergedGdd(null)
      setQaOut(null)
      setQaScore(null)
      setQaDecision(null)
      setQaApproved(false)
      setQaRevisionCount(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPmStatus(null)
      setBusy(false)
    }
  }, [apiKey, guard, models, pmMessages])

  const runLeadStep = useCallback(
    async (revision?: { prior: string; feedback: string }) => {
      if (!guard() || !models || !prd) return
      setBusy(true)
      setError(null)
      try {
        const out = await runLead(
          apiKey,
          models.lead,
          prd,
          revision
            ? { priorLead: revision.prior, feedback: revision.feedback }
            : undefined,
        )
        setLeadOut(out)
        setSubs(null)
        setMergedGdd(null)
        setQaOut(null)
        setQaScore(null)
        setQaDecision(null)
        setQaApproved(false)
        setQaRevisionCount(0)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [apiKey, guard, models, prd],
  )

  const runSubsStep = useCallback(async () => {
    if (!guard() || !models || !leadOut) return
    setBusy(true)
    setError(null)
    try {
      const out = await runAllSubs(apiKey, models, leadOut)
      setSubs(out)
      setMergedGdd(null)
      setQaOut(null)
      setQaScore(null)
      setQaDecision(null)
      setQaApproved(false)
      setQaRevisionCount(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiKey, guard, leadOut, models])

  const runMergeStep = useCallback(async () => {
    if (!guard() || !models || !prd || !leadOut || !subs) return
    setBusy(true)
    setError(null)
    try {
      const out = await runMerge(apiKey, models.merger, {
        prd,
        lead: leadOut,
        gameplay: subs.gameplay,
        systems: subs.systems,
        narrative: subs.narrative,
        level: subs.level,
      })
      setMergedGdd(out)
      setQaOut(null)
      setQaScore(null)
      setQaDecision(null)
      setQaApproved(false)
      setQaRevisionCount(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiKey, guard, leadOut, models, prd, subs])

  const runQaStep = useCallback(async () => {
    if (!guard() || !models || !prd || !mergedGdd) return
    setBusy(true)
    setError(null)
    try {
      const acc = extractAcceptanceCriteria(prd)
      const out = await runQa(apiKey, models.qa, acc, mergedGdd)
      setQaOut(out)
      const score = parseQaTotalScore(out)
      const decision = parseQaDecision(out)
      setQaScore(score)
      setQaDecision(decision)
      setQaApproved(isQaPassed(score, decision))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiKey, guard, mergedGdd, models, prd])

  const runFullChain = useCallback(async () => {
    if (!guard() || !models || !prd) return
    setBusy(true)
    setError(null)
    setQaApproved(false)
    setQaRevisionCount(0)
    const completed: string[] = []
    setPipelineRun({
      completed: [],
      current: '主策划（Josh Sawyer）正在生成任务书与 GDD 骨架…',
      status: 'running',
    })
    try {
      let lead = await runLead(apiKey, models.lead, prd)
      setLeadOut(lead)
      completed.push('主策划')
      setPipelineRun({
        completed: [...completed],
        current: '子策划并行：玩法 / 数值 / 叙事 / 关卡（四路同时请求）…',
        status: 'running',
      })

      let subOut = await runAllSubs(apiKey, models, lead)
      setSubs(subOut)
      completed.push('子策划（并行）')
      setPipelineRun({
        completed: [...completed],
        current: '合并 GDD（整合为总体方案）…',
        status: 'running',
      })

      let merged = await runMerge(apiKey, models.merger, {
        prd,
        lead,
        gameplay: subOut.gameplay,
        systems: subOut.systems,
        narrative: subOut.narrative,
        level: subOut.level,
      })
      setMergedGdd(merged)
      completed.push('合并 GDD')
      setPipelineRun({
        completed: [...completed],
        current: 'QA 红队评审（第 1 次）…',
        status: 'running',
      })

      const acc = extractAcceptanceCriteria(prd)
      let qaText = await runQa(apiKey, models.qa, acc, merged)
      setQaOut(qaText)
      let score = parseQaTotalScore(qaText)
      let decision = parseQaDecision(qaText)
      setQaScore(score)
      setQaDecision(decision)
      let qaRound = 1
      completed.push(`QA 验收（第 ${qaRound} 次）`)

      let passed = isQaPassed(score, decision)
      if (passed) {
        setQaApproved(true)
        setPipelineRun({
          completed: [...completed],
          current: `全部完成（QA ≥ ${QA_PASS_SCORE}）`,
          status: 'done',
        })
      } else {
        setPipelineRun({
          completed: [...completed],
          current: 'QA 未通过，正在按 QA 意见进入修订…',
          status: 'running',
        })

        let revisions = 0
        while (!passed && revisions < MAX_QA_ITERATIONS - 1) {
          revisions += 1
          const revisionFeedback = parseQaRevisionFeedback(qaText)
          setQaRevisionCount(revisions)
          setPipelineRun({
            completed: [...completed],
            current: `第 ${revisions} 轮修订 · 主策划根据 QA 重写任务书…`,
            status: 'running',
          })
          lead = await runLead(apiKey, models.lead, prd, {
            priorLead: lead,
            feedback: revisionFeedback?.lead?.trim() ? revisionFeedback.lead : qaText,
          })
          setLeadOut(lead)
          completed.push(`第 ${revisions} 轮 · 主策划`)
          setPipelineRun({
            completed: [...completed],
            current: `第 ${revisions} 轮 · 子策划并行…`,
            status: 'running',
          })

          subOut = await runAllSubs(apiKey, models, lead, {
            prior: subOut,
            feedback: revisionFeedback ?? undefined,
          })
          setSubs(subOut)
          completed.push(`第 ${revisions} 轮 · 子策划`)
          setPipelineRun({
            completed: [...completed],
            current: `第 ${revisions} 轮 · 合并 GDD…`,
            status: 'running',
          })

          merged = await runMerge(apiKey, models.merger, {
            prd,
            lead,
            gameplay: subOut.gameplay,
            systems: subOut.systems,
            narrative: subOut.narrative,
            level: subOut.level,
          })
          setMergedGdd(merged)
          completed.push(`第 ${revisions} 轮 · 合并`)
          qaRound += 1
          setPipelineRun({
            completed: [...completed],
            current: `QA 红队评审（第 ${qaRound} 次）…`,
            status: 'running',
          })

          qaText = await runQa(apiKey, models.qa, acc, merged)
          setQaOut(qaText)
          score = parseQaTotalScore(qaText)
          decision = parseQaDecision(qaText)
          setQaScore(score)
          setQaDecision(decision)
          completed.push(`QA 验收（第 ${qaRound} 次）`)
          passed = isQaPassed(score, decision)

          if (passed) {
            setQaApproved(true)
            setPipelineRun({
              completed: [...completed],
              current: `全部完成（QA ≥ ${QA_PASS_SCORE}）`,
              status: 'done',
            })
            break
          }
        }

        if (!passed) {
          setQaApproved(false)
          setPipelineRun({
            completed: [...completed],
            current: `流程暂停：QA 仍未通过（总分 ${score ?? '未解析'}），请继续迭代`,
            status: 'done',
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setPipelineRun({
        completed,
        current: '执行中断',
        status: 'error',
        errorMessage: msg,
      })
    } finally {
      setBusy(false)
    }
  }, [apiKey, guard, models, prd])

  const qaNeedsRevision =
    !!qaOut &&
    !qaApproved &&
    qaRevisionCount < MAX_QA_ITERATIONS - 1

  const manualRevision = useCallback(async () => {
    if (!guard() || !models || !prd || !leadOut || !qaOut) return
    if (qaRevisionCount >= MAX_QA_ITERATIONS - 1) return
    setBusy(true)
    setError(null)
    const completed: string[] = []
    const nextCount = qaRevisionCount + 1
    const revisionFeedback = parseQaRevisionFeedback(qaOut)
    setQaApproved(false)
    setPipelineRun({
      completed: [],
      current: `手动第 ${nextCount} 轮 · 主策划修订…`,
      status: 'running',
    })
    try {
      setQaRevisionCount(nextCount)
      const lead = await runLead(apiKey, models.lead, prd, {
        priorLead: leadOut,
        feedback: revisionFeedback?.lead?.trim() ? revisionFeedback.lead : qaOut,
      })
      setLeadOut(lead)
      completed.push(`第 ${nextCount} 轮 · 主策划`)
      setPipelineRun({
        completed: [...completed],
        current: `手动第 ${nextCount} 轮 · 子策划并行…`,
        status: 'running',
      })
      const subOut = await runAllSubs(apiKey, models, lead, {
        prior: subs ?? undefined,
        feedback: revisionFeedback ?? undefined,
      })
      setSubs(subOut)
      completed.push(`第 ${nextCount} 轮 · 子策划`)
      setPipelineRun({
        completed: [...completed],
        current: `手动第 ${nextCount} 轮 · 合并 GDD…`,
        status: 'running',
      })
      const merged = await runMerge(apiKey, models.merger, {
        prd,
        lead,
        gameplay: subOut.gameplay,
        systems: subOut.systems,
        narrative: subOut.narrative,
        level: subOut.level,
      })
      setMergedGdd(merged)
      completed.push(`第 ${nextCount} 轮 · 合并`)
      setPipelineRun({
        completed: [...completed],
        current: 'QA 验收…',
        status: 'running',
      })
      const acc = extractAcceptanceCriteria(prd)
      const qaText = await runQa(apiKey, models.qa, acc, merged)
      setQaOut(qaText)
      const parsed = parseQaTotalScore(qaText)
      const decision = parseQaDecision(qaText)
      setQaScore(parsed)
      setQaDecision(decision)
      completed.push('QA 验收')
      const passed = isQaPassed(parsed, decision)
      setQaApproved(passed)
      setPipelineRun({
        completed: [...completed],
        current:
          passed
            ? `手动迭代完成（QA ≥ ${QA_PASS_SCORE}）`
            : `手动迭代结束（QA 未通过，总分 ${parsed ?? '未解析'}）`,
        status: 'done',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setPipelineRun({
        completed,
        current: '执行中断',
        status: 'error',
        errorMessage: msg,
      })
    } finally {
      setBusy(false)
    }
  }, [
    apiKey,
    guard,
    leadOut,
    models,
    prd,
    qaApproved,
    qaRevisionCount,
    qaOut,
    subs,
  ])

  const disabled = busy || !models
  const pmWaiting =
    busy && !pipelineRun && !pmStatus ? '正在等待 PM 回复…' : null

  return (
    <div className="pipeline-page">
      <header className="pipeline-header">
        <p className="pipeline-kicker">工作台</p>
        <h1 className="pipeline-title">多智能体游戏设计管线</h1>
        <p className="pipeline-lead">
          与 PM 对话 → 生成 PRD → 主策划 / 子策划并行 → 合并 GDD → QA
          打分（满分 100，≥{QA_PASS_SCORE} 及格）。请确认已运行{' '}
          <code>npm run dev</code>（含本地 API 代理）。
        </p>
        <div className="pipeline-toolbar">
          <button
            type="button"
            className="btn ghost small"
            onClick={refreshConfig}
          >
            重新载入配置
          </button>
          {!apiKey.trim() && (
            <span className="pipeline-warn">未检测到 API Key，请到「API 与模型」保存。</span>
          )}
        </div>
      </header>

      {error && (
        <div className="pipeline-error" role="alert">
          {error}
        </div>
      )}

      <section className="pipeline-section">
        <h2 className="pipeline-h2">1. PM（Yoshi-P）</h2>
        <div className="chat-panel">
          <div className="chat-log" aria-live="polite">
            {pmMessages
              .filter((m) => m.role !== 'system')
              .map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`chat-bubble chat-bubble--${m.role}`}
                >
                  <span className="chat-role">
                    {m.role === 'user' ? '你' : 'PM'}
                  </span>
                  <pre className="chat-text">{m.content}</pre>
                </div>
              ))}
          </div>
          <div className="chat-input-row">
            <textarea
              className="input chat-input"
              rows={3}
              placeholder="描述游戏想法，或回答 PM 的提问…"
              value={pmInput}
              onChange={(e) => setPmInput(e.target.value)}
              disabled={disabled}
              aria-busy={busy && !pipelineRun ? true : undefined}
            />
            <div className="chat-actions">
              <button
                type="button"
                className="btn primary"
                disabled={disabled || !pmInput.trim()}
                onClick={() => void sendPm()}
              >
                {busy && !pipelineRun && !pmStatus ? '发送中…' : '发送'}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={disabled}
                onClick={() => void finalizePrd()}
              >
                {pmStatus ? '生成中…' : '生成 PRD'}
              </button>
            </div>
            {(pmStatus || pmWaiting) && (
              <p className="pm-status" role="status" aria-live="polite">
                <span className="pm-status-dot" aria-hidden />
                {pmStatus ?? pmWaiting}
              </p>
            )}
          </div>
        </div>
      </section>

      {prd && (
        <section className="pipeline-section">
          <h2 className="pipeline-h2">PRD</h2>
          <pre className="doc-block">{prd}</pre>
        </section>
      )}

      <section className="pipeline-section">
        <h2 className="pipeline-h2">2. 主策划与子模块</h2>
        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            disabled={disabled || !prd}
            onClick={() => void runLeadStep()}
          >
            运行主策划
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={disabled || !leadOut}
            onClick={() => void runSubsStep()}
          >
            并行运行子策划
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={disabled || !subs}
            onClick={() => void runMergeStep()}
          >
            合并 GDD
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={disabled || !prd || !mergedGdd}
            onClick={() => void runQaStep()}
          >
            QA 验收
          </button>
        </div>
        <p className="pipeline-hint">
          或一键：主策划 → 四路子策划 → 合并 → QA，未达标时自动按 QA 意见迭代最多{' '}
          {MAX_QA_ITERATIONS} 轮。
        </p>
        <button
          type="button"
          className="btn primary pipeline-wide"
          disabled={disabled || !prd}
          onClick={() => void runFullChain()}
        >
          {busy && pipelineRun?.status === 'running'
            ? '管线执行中…'
            : '一键执行后续管线（含 QA 迭代）'}
        </button>

        {pipelineRun && (
          <div
            ref={pipelineProgressRef}
            className="pipeline-progress"
            role="status"
            aria-live="polite"
          >
            <div className="pipeline-progress-head">
              <span className="pipeline-progress-title">管线进度</span>
              {pipelineRun.status === 'running' && (
                <span className="pipeline-progress-badge">进行中</span>
              )}
              {pipelineRun.status === 'done' && (
                <span className="pipeline-progress-badge pipeline-progress-badge--done">
                  已结束
                </span>
              )}
              {pipelineRun.status === 'error' && (
                <span className="pipeline-progress-badge pipeline-progress-badge--err">
                  出错
                </span>
              )}
            </div>
            <ul className="pipeline-progress-list">
              {pipelineRun.completed.map((label, i) => (
                <li key={`done-${i}-${label}`} className="pipeline-progress-item is-done">
                  <span className="pipeline-progress-check" aria-hidden>
                    ✓
                  </span>
                  <span>{label}</span>
                </li>
              ))}
              {pipelineRun.status === 'running' && (
                <li className="pipeline-progress-item is-active">
                  <span className="pipeline-progress-spinner" aria-hidden />
                  <span>{pipelineRun.current}</span>
                </li>
              )}
              {pipelineRun.status === 'done' && (
                <li className="pipeline-progress-item is-final">
                  <span>{pipelineRun.current}</span>
                </li>
              )}
              {pipelineRun.status === 'error' && (
                <li className="pipeline-progress-item is-error">
                  <span>{pipelineRun.errorMessage ?? pipelineRun.current}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {!qaApproved && (leadOut || subs || mergedGdd) && (
          <p className="pipeline-hint">
            当前为内部迭代稿，系统会继续按 QA 意见修订；仅当 QA 通过后才展示最终方案给你。
          </p>
        )}

        {qaApproved && leadOut && (
          <>
            <h3 className="pipeline-h3">主策划输出</h3>
            <pre className="doc-block doc-block--sm">{leadOut}</pre>
          </>
        )}

        {qaApproved && subs && (
          <>
            <h3 className="pipeline-h3">子策划（并行结果）</h3>
            <div className="sub-grid">
              <div>
                <h4>玩法</h4>
                <pre className="doc-block doc-block--sm">{subs.gameplay}</pre>
              </div>
              <div>
                <h4>数值</h4>
                <pre className="doc-block doc-block--sm">{subs.systems}</pre>
              </div>
              <div>
                <h4>叙事</h4>
                <pre className="doc-block doc-block--sm">{subs.narrative}</pre>
              </div>
              <div>
                <h4>关卡</h4>
                <pre className="doc-block doc-block--sm">{subs.level}</pre>
              </div>
            </div>
          </>
        )}

        {qaApproved && mergedGdd && (
          <>
            <h3 className="pipeline-h3">合并 GDD</h3>
            <pre className="doc-block">{mergedGdd}</pre>
          </>
        )}
      </section>

      {(qaOut || qaScore !== null) && (
        <section className="pipeline-section">
          <h2 className="pipeline-h2">3. QA（Gabe Newell）</h2>
          {qaScore !== null && (
            <p className="qa-score">
              解析总分：<strong>{qaScore}</strong> / 100
              {qaScore >= QA_PASS_SCORE ? '（及格）' : '（未及格）'}
              {qaRevisionCount > 0 && ` · 修订轮次 ${qaRevisionCount}`}
              {(qaDecision || qaScore !== null) &&
                ` · 判定：${qaApproved ? '通过' : '驳回修改'}`}
            </p>
          )}
          {qaOut && <pre className="doc-block">{qaOut}</pre>}
          {qaOut && !qaApproved && (
            <button
              type="button"
              className="btn ghost"
              disabled={disabled || !qaNeedsRevision}
              onClick={() => void manualRevision()}
            >
              按 QA 意见手动再迭代一轮
            </button>
          )}
        </section>
      )}
    </div>
  )
}
