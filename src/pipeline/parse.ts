/** 从 QA 输出中解析总分（用于判定是否 ≥80）。 */
export function parseQaTotalScore(text: string): number | null {
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

/** 从 PRD 中抽取验收标准段落，供 QA system 使用。 */
export function extractAcceptanceCriteria(prd: string): string {
  const block = prd.match(
    /【初步验收标准】[：:]\s*([\s\S]*?)(?=\n- 【|$)/,
  )
  return block?.[1]?.trim() ?? prd.slice(0, 2000)
}
