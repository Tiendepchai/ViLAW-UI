import { BACKEND_URL, STORAGE_MODE } from './config'
import type { Conversation } from '../types/chat'

const LS_KEY = 'datt_chat_conversations_v1'

function readLocal(): Conversation[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Conversation[]
  } catch {
    return []
  }
}

function writeLocal(convs: Conversation[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(convs, null, 2))
}

async function readServer(): Promise<Conversation[]> {
  const res = await fetch(`${BACKEND_URL}/conversations`)
  if (!res.ok) throw new Error('Cannot load conversations from server')
  return (await res.json()) as Conversation[]
}

async function writeServer(convs: Conversation[]): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/conversations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(convs),
  })
  if (!res.ok) throw new Error('Cannot save conversations to server')
}

export async function loadConversations(): Promise<Conversation[]> {
  return STORAGE_MODE === 'server' ? readServer() : Promise.resolve(readLocal())
}

export async function saveConversations(convs: Conversation[]): Promise<void> {
  if (STORAGE_MODE === 'server') return writeServer(convs)
  writeLocal(convs)
}

export function exportJson(convs: Conversation[]) {
  const blob = new Blob([JSON.stringify(convs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conversations_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importJsonFile(file: File): Promise<Conversation[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('JSON phải là một mảng Conversation[]')
  return data as Conversation[]
}
