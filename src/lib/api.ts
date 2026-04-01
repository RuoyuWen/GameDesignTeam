export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(params: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
}): Promise<string> {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const raw = await r.text()
  let data: { text?: string; error?: string } | null = null
  if (raw.trim()) {
    try {
      data = JSON.parse(raw) as { text?: string; error?: string }
    } catch {
      // Keep data as null and report a clearer error below.
    }
  }

  if (!r.ok) {
    throw new Error(data?.error || `请求失败 ${r.status}`)
  }
  if (!data) {
    throw new Error(
      '服务返回了非 JSON 响应，请确认本地 API 服务已启动且代理配置正常（npm run dev）。',
    )
  }
  return data.text ?? ''
}
