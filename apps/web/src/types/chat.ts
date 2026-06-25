export type Role = 'user' | 'assistant'

export type Citation = {
  tag: string
  title: string
  url?: string
  doc_id?: string
  chunk_id?: string | number
}

export type ChatMessage = {
  id: string
  role: Role
  content: string
  createdAt: number
  citations?: Citation[]
}

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export type AskResponse = {
  answer: string
  citations?: Citation[]
  used_ctx?: number
  hits?: unknown
}
