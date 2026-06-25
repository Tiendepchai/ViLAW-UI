import { BACKEND_URL, DEFAULT_TOP_K } from './config'
import type { AskResponse } from '../types/chat'

export async function ask(question: string, opts?: { top_k?: number; conversation_id?: string }) {
  const res = await fetch(`${BACKEND_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      top_k: opts?.top_k ?? DEFAULT_TOP_K,
      conversation_id: opts?.conversation_id,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }

  return (await res.json()) as AskResponse
}
