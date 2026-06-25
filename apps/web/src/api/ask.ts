import { BACKEND_URL, DEFAULT_TOP_K } from '../lib/config'
import type { AskResponse, Citation } from '../types/chat'

export async function ask(question: string, opts?: { top_k?: number; conversation_id?: string }): Promise<AskResponse> {
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

export type StreamCallback = {
  onToken: (token: string) => void
  onCitations: (citations: Citation[]) => void
  onDone: () => void
  onError: (error: string) => void
}

export async function askStream(
  question: string,
  callbacks: StreamCallback,
  opts?: { top_k?: number },
): Promise<void> {
  const url = `${BACKEND_URL}/api/ask/stream`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        top_k: opts?.top_k ?? DEFAULT_TOP_K,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      callbacks.onError(text || `Stream failed: ${res.status}`)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      callbacks.onError('No response body')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          callbacks.onDone()
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.token) {
            callbacks.onToken(parsed.token)
          }
          if (parsed.citations) {
            callbacks.onCitations(parsed.citations)
          }
          if (parsed.done) {
            callbacks.onDone()
          }
          if (parsed.error) {
            callbacks.onError(parsed.error)
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    callbacks.onDone()
  } catch (e) {
    callbacks.onError((e as Error)?.message ?? 'Stream connection failed')
  }
}
