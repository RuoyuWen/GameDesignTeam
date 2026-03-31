import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '4mb' }))

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body as {
      apiKey?: string
      model?: string
      messages?: ChatMessage[]
      temperature?: number
    }
    const { apiKey, model, messages, temperature } = body
    if (!apiKey?.trim() || !model?.trim() || !Array.isArray(messages)) {
      res.status(400).json({ error: '缺少 apiKey、model 或 messages' })
      return
    }

    const openai = new OpenAI({ apiKey: apiKey.trim() })

    const completion = await openai.chat.completions.create({
      model: model.trim(),
      messages,
      temperature: temperature ?? 0.7,
    })

    const text = completion.choices[0]?.message?.content ?? ''
    res.json({ text })
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number }
    const status = typeof err.status === 'number' ? err.status : 500
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: err.message ?? String(e),
    })
  }
})

const PORT = Number(process.env.PORT) || 8787
app.listen(PORT, () => {
  console.log(`[gamedesign] API 监听 http://localhost:${PORT}`)
})
