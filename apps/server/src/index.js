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

const DATA_FILE = process.env.DATA_FILE
  ?? path.resolve(process.cwd(), '../../data/conversations.json')

// Use SQLite for conversations when possible, fallback to JSON file
let db = null
const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), '../../data/vilaw.db')

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
  console.warn('[server] SQLite unavailable, falling back to JSON file:', e.message)
  db = null
}

async function readConvs() {
  if (db) {
    const convs = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all()
    const getMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at')
    return convs.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      messages: getMessages.all(c.id).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        citations: safeJsonParse(m.citations, []),
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

async function writeConvs(convs) {
  if (db) {
    const transaction = db.transaction((items) => {
      for (const c of items) {
        db.prepare(
          'INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).run(c.id, c.title ?? 'New chat', c.createdAt ?? 0, c.updatedAt ?? 0)
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(c.id)
        const insertMsg = db.prepare(
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

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, project_api: PROJECT_API_BASE, storage: db ? 'sqlite' : 'json' })
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
    '/v1/ask',
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
  console.log(`[server] storage=${db ? 'sqlite' : 'json'}`)
})
