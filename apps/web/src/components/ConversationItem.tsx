import type { Conversation } from '../types/chat'

interface Props {
  title: string
  msgCount: number
  time: string
  isActive: boolean
  onClick: () => void
}

export function ConversationItem({ title, msgCount, time, isActive, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      className={`flex flex-col gap-1.5 p-2.5 rounded-xl cursor-pointer border border-transparent transition-colors
        ${isActive ? 'border-[#334155] bg-white/4' : 'hover:bg-white/3'}`}
    >
      <div className="font-semibold truncate text-sm">{title}</div>
      <div className="flex gap-2 text-xs text-[#9ca3af]">
        <span>{msgCount} msg</span>
        <span>•</span>
        <span>{time}</span>
      </div>
    </div>
  )
}
