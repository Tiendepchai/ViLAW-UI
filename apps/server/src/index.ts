import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = Number(process.env.PORT ?? 8787)
const PROJECT_API_BASE = process.env.PROJECT_API_BASE ?? 'http://localhost:8080'
const ASK_PATH = process.env.PROJECT_ASK_PATH ?? ''
const DATA_FILE = process.env.DATA_FILE ?? path.resolve(process.cwd(), '../../data/conversations.json')
const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), '../../data/vilaw.db')

// ── SQLite ──
let db: Database.Database | null = null
try {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      title       TEXT DEFAULT 'New chat',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content         TEXT NOT NULL,
      citations       TEXT DEFAULT '[]',
      created_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  `)
  console.log('[server] Using SQLite:', DB_PATH)
} catch (e) {
  console.warn('[server] SQLite unavailable, falling back to JSON file:', (e as Error).message)
  db = null
}

// ── Helpers ──
interface Citation {
  tag?: string
  title?: string
  url?: string
  doc_id?: string
  chunk_id?: string | number
  [key: string]: unknown
}

interface Message {
  id: string
  role: string
  content: string
  createdAt: number
  citations?: Citation[]
}

interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}

function safeJsonParse(str: string, fallback: unknown): unknown {
  try { return JSON.parse(str) } catch { return fallback }
}

// ── Conversation I/O ──
async function readConvs(): Promise<Conversation[]> {
  if (db) {
    const convs = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Array<{
      id: string; title: string; created_at: number; updated_at: number
    }>
    const getMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at')
    return convs.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      messages: (getMessages.all(c.id) as Array<{
        id: string; role: string; content: string; citations: string; created_at: number
      }>).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        citations: safeJsonParse(m.citations, []) as Citation[],
      })),
    }))
  }

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function writeConvs(convs: Conversation[]): Promise<void> {
  if (db) {
    const transaction = db.transaction((items: Conversation[]) => {
      for (const c of items) {
        db!.prepare(
          'INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).run(c.id, c.title ?? 'New chat', c.createdAt ?? 0, c.updatedAt ?? 0)
        db!.prepare('DELETE FROM messages WHERE conversation_id = ?').run(c.id)
        const insertMsg = db!.prepare(
          'INSERT INTO messages (id, conversation_id, role, content, citations, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        for (const m of c.messages ?? []) {
          insertMsg.run(m.id, c.id, m.role, m.content, JSON.stringify(m.citations ?? []), m.createdAt ?? 0)
        }
      }
    })
    transaction(convs)
    return
  }

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(convs, null, 2), 'utf8')
}

// ── Routes ──
app.get('/health', (_req, res) => {
  res.json({ ok: true, project_api: PROJECT_API_BASE, storage: db ? 'sqlite' : 'json' })
})

app.get('/conversations', async (_req, res) => {
  res.json(await readConvs())
})

app.put('/conversations', async (req, res) => {
  const convs = req.body as unknown
  if (!Array.isArray(convs)) {
    res.status(400).json({ error: 'Body phải là Conversation[]' })
    return
  }
  await writeConvs(convs)
  res.json({ ok: true, count: convs.length })
})

// ── Proxy to backend ──
const PROJECT_SEARCH_PATH = process.env.PROJECT_SEARCH_PATH ?? '/search'

// SSE stream proxy: pipe backend SSE through to the client
app.post('/api/ask/stream', async (req, res) => {
  const { question, top_k } = (req.body ?? {}) as { question?: string; top_k?: number }
  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Thiếu question (string)' })
    return
  }

  const streamUrl = (PROJECT_API_BASE.replace(/\/$/, '') + '/v1/ask/stream')

  try {
    const backendRes = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: question, top_k: top_k ?? 6 }),
    })

    if (!backendRes.ok) {
      res.status(502).json({ error: 'Backend stream unavailable', detail: backendRes.status })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const reader = backendRes.body?.getReader()
    if (!reader) {
      res.status(502).json({ error: 'No response body from backend' })
      return
    }

    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      res.write(text)
    }
    res.end()
  } catch (e) {
    res.status(502).json({ error: 'Stream proxy failed', detail: (e as Error).message })
  }
})
interface PostResult {
  ok: boolean
  status: number
  text: string
  json: Record<string, unknown> | null
}

async function postJson(url: string, body: Record<string, unknown>): Promise<PostResult> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let json: Record<string, unknown> | null = null
  try { json = text ? JSON.parse(text) : null } catch { /* ignore */ }
  return { ok: r.ok, status: r.status, text, json }
}

interface NormalizedAsk {
  answer: string
  citations: Citation[]
  used_ctx: number | null
}

function normalizeAskResponse(obj: Record<string, unknown> | null): NormalizedAsk | null {
  if (!obj || typeof obj !== 'object') return null
  const answer = String(obj.answer ?? obj.response ?? obj.text ?? obj.result ?? obj.message ?? '')
  const citations = (obj.citations ?? obj.sources ?? obj.references) as Citation[] | undefined
  const used_ctx = (obj.used_ctx ?? obj.used_context ?? obj.k ?? null) as number | null
  return { answer, citations: Array.isArray(citations) ? citations : [], used_ctx }
}

app.post('/api/ask', async (req, res) => {
  const { question, top_k } = (req.body ?? {}) as { question?: string; top_k?: number }
  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Thiếu question (string)' })
    return
  }

  const paths = [
    ...(ASK_PATH ? [ASK_PATH] : []),
    '/ask',
    '/v1/ask',
    '/rag',
    '/qa',
    '/chat',
    '/answer',
  ]

  const payloads: Record<string, unknown>[] = [
    { question, top_k },
    { q: question, top_k },
    { query: question, top_k },
    { message: question, top_k },
  ]

  let lastErr: string | null = null

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
          res.json(normalized)
          return
        }
        res.json(r.json ?? { answer: r.text })
        return
      } catch (e) {
        lastErr = `${p} -> ${(e as Error)?.message ?? String(e)}`
      }
    }
  }

  res.status(502).json({
    error: 'Không gọi được API dự án gốc. Hãy cấu hình PROJECT_API_BASE/PROJECT_ASK_PATH đúng.',
    tried_base: PROJECT_API_BASE,
    last_error: lastErr,
  })
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log(`[server] DATA_FILE=${DATA_FILE}`)
  console.log(`[server] PROJECT_API_BASE=${PROJECT_API_BASE}`)
  console.log(`[server] storage=${db ? 'sqlite' : 'json'}`)
})
