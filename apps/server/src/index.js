import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = Number(process.env.PORT ?? 8787)
const PROJECT_API_BASE = process.env.PROJECT_API_BASE ?? 'http://localhost:8080'
const ASK_PATH = process.env.PROJECT_ASK_PATH ?? '' // optional override

const DATA_FILE = process.env.DATA_FILE
  ?? path.resolve(process.cwd(), '../../data/conversations.json')

async function readConvs() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function writeConvs(convs) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(convs, null, 2), 'utf8')
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, project_api: PROJECT_API_BASE })
})

app.get('/conversations', async (_req, res) => {
  res.json(await readConvs())
})

app.put('/conversations', async (req, res) => {
  const convs = req.body
  if (!Array.isArray(convs)) {
    return res.status(400).json({ error: 'Body phải là Conversation[]' })
  }
  await writeConvs(convs)
  res.json({ ok: true, count: convs.length })
})

async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* ignore */ }
  return { ok: r.ok, status: r.status, text, json }
}

function normalizeAskResponse(obj) {
  if (!obj || typeof obj !== 'object') return null
  const answer = obj.answer ?? obj.response ?? obj.text ?? obj.result ?? obj.message
  const citations = obj.citations ?? obj.sources ?? obj.references
  const used_ctx = obj.used_ctx ?? obj.used_context ?? obj.k
  return { answer: answer ?? '', citations: Array.isArray(citations) ? citations : [], used_ctx }
}

app.post('/api/ask', async (req, res) => {
  const { question, top_k } = req.body ?? {}
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Thiếu question (string)' })
  }

  const paths = [
    ...(ASK_PATH ? [ASK_PATH] : []),
    '/ask',
    '/rag',
    '/qa',
    '/chat',
    '/answer',
  ]

  const payloads = [
    { question, top_k },
    { q: question, top_k },
    { query: question, top_k },
    { message: question, top_k },
  ]

  let lastErr = null

  for (const p of paths) {
    const url = PROJECT_API_BASE.replace(/\/$/, '') + p
    for (const body of payloads) {
      try {
        const r = await postJson(url, body)
        if (!r.ok) {
          lastErr = `${p} -> ${r.status} ${r.text?.slice(0, 140)}`
          continue
        }
        const normalized = normalizeAskResponse(r.json)
        if (normalized && normalized.answer) {
          return res.json(normalized)
        }
        // nếu trả về json nhưng không đúng shape, cứ pass-through
        return res.json(r.json ?? { answer: r.text })
      } catch (e) {
        lastErr = `${p} -> ${e?.message ?? e}`
      }
    }
  }

  return res.status(502).json({
    error: 'Không gọi được API dự án gốc. Hãy cấu hình PROJECT_API_BASE/PROJECT_ASK_PATH đúng.',
    tried_base: PROJECT_API_BASE,
    last_error: lastErr,
  })
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log(`[server] DATA_FILE=${DATA_FILE}`)
  console.log(`[server] PROJECT_API_BASE=${PROJECT_API_BASE}`)
})
