import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../types/chat'
import { CitationPanel } from './CitationPanel'

interface Props {
  message: ChatMessage
  isCitationsOpen: boolean
  onToggleCitations: (id: string) => void
}

function fmtTime(ts: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  })
}

export function Message({ message, isCitationsOpen, onToggleCitations }: Props) {
  return (
    <div className={`flex gap-3 items-start max-w-[920px] ${message.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-xl bg-[#111827] border border-[#1f2937] flex items-center justify-center font-extrabold text-[#cbd5e1] shrink-0 text-sm">
        {message.role === 'user' ? 'U' : 'AI'}
      </div>

      <div className={`border border-[#1f2937] rounded-xl px-3.5 py-3 min-w-0 ${
        message.role === 'user' ? 'bg-[#0f1b2d] border-[#1f2a44]' : 'bg-[#111827]'
      }`}>
        <div className="text-xs text-[#9ca3af] mb-1.5">
          {message.role === 'user' ? 'Bạn' : 'Trợ lý'} {fmtTime(message.createdAt) ? `• ${fmtTime(message.createdAt)}` : ''}
        </div>

        <div className="whitespace-pre-wrap leading-relaxed">
          {message.role === 'assistant' ? (
            <ReactMarkdown>{message.content || (message.id ? '' : '...')}</ReactMarkdown>
          ) : (
            message.content
          )}
        </div>

        {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
          <CitationPanel
            citations={message.citations}
            messageId={message.id}
            isOpen={isCitationsOpen}
            onToggle={() => onToggleCitations(message.id)}
          />
        )}
      </div>
    </div>
  )
}
