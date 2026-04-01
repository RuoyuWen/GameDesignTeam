/** 从 QA 输出中解析总分（用于判定是否达标）。 */
export function parseQaTotalScore(text: string): number | null {
  const json = parseQaReviewJson(text)
  const scoreFromJson =
    typeof json?.gate?.total_score === 'number'
      ? json.gate.total_score
      : typeof json?.total_score === 'number'
        ? json.total_score
        : null
  if (scoreFromJson !== null && scoreFromJson >= 0 && scoreFromJson <= 100) {
    return scoreFromJson
  }

  const patterns = [
    /【总分】[：:\s]*(\d{1,3})\s*分?/i,
    /总分[：:\s]*(\d{1,3})\s*分/i,
    /总分[：:\s]*(\d{1,3})(?!\d)/,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!Number.isNaN(n) && n >= 0 && n <= 100) return n
    }
  }
  return null
}

/** 从 QA 输出中解析判定结果（通过 / 驳回）。 */
export function parseQaDecision(text: string): 'pass' | 'reject' | null {
  const json = parseQaReviewJson(text)
  const decisionFromJson =
    typeof json?.gate?.decision === 'string'
      ? json.gate.decision
      : typeof json?.decision === 'string'
        ? json.decision
        : null
  if (decisionFromJson) {
    if (/通过|pass|approved?/i.test(decisionFromJson)) return 'pass'
    if (/驳回|不通过|reject|revise/i.test(decisionFromJson)) return 'reject'
  }

  const normalized = text.replace(/\s+/g, '')
  const decisionLine = normalized.match(/【?判定结果】?[：:]\s*([^\n\r。；;]+)/i)
  const source = decisionLine?.[1] ?? normalized
  if (/通过|放行|准许进入开发|可进入开发/.test(source)) return 'pass'
  if (/驳回|不通过|退回|需修改|修改后重审/.test(source)) return 'reject'
  return null
}

export type QaRevisionFeedback = {
  lead?: string
  gameplay?: string
  systems?: string
  narrative?: string
  level?: string
}

/** 解析 QA 的 JSON 修订意见，供各模块按“只读本模块意见”迭代。 */
export function parseQaRevisionFeedback(text: string): QaRevisionFeedback | null {
  const json = parseQaReviewJson(text)
  if (!json) return null
  const raw = json.revision_feedback
  if (!raw || typeof raw !== 'object') return null
  const pick = (key: keyof QaRevisionFeedback) =>
    typeof raw[key] === 'string' ? raw[key].trim() : undefined
  const out: QaRevisionFeedback = {
    lead: pick('lead'),
    gameplay: pick('gameplay'),
    systems: pick('systems'),
    narrative: pick('narrative'),
    level: pick('level'),
  }
  if (!out.lead && !out.gameplay && !out.systems && !out.narrative && !out.level) {
    return null
  }
  return out
}

type QaReviewJson = {
  total_score?: number
  decision?: string
  gate?: { total_score?: number; decision?: string }
  revision_feedback?: Partial<QaRevisionFeedback>
}

function parseQaReviewJson(text: string): QaReviewJson | null {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1]) as QaReviewJson
    } catch {
      // Continue with fallback parsing below.
    }
  }

  const key = text.indexOf('"revision_feedback"')
  if (key >= 0) {
    const start = text.lastIndexOf('{', key)
    const end = text.indexOf('}', key)
    if (start >= 0 && end > start) {
      const jsonCandidate = text.slice(start, text.lastIndexOf('}') + 1)
      try {
        return JSON.parse(jsonCandidate) as QaReviewJson
      } catch {
        return null
      }
    }
  }
  return null
}

/** 从 PRD 中抽取验收标准段落，供 QA system 使用。 */
export function extractAcceptanceCriteria(prd: string): string {
  const block = prd.match(
    /【初步验收标准】[：:]\s*([\s\S]*?)(?=\n- 【|$)/,
  )
  return block?.[1]?.trim() ?? prd.slice(0, 2000)
}
