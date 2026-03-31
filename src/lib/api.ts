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
  const data = (await r.json()) as { text?: string; error?: string }
  if (!r.ok) {
    throw new Error(data.error || `请求失败 ${r.status}`)
  }
  return data.text ?? ''
}
