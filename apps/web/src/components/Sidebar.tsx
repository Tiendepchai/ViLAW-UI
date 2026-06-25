import { useRef } from 'react'
import { useChatStore } from '../stores/chatStore'

export function Sidebar() {
  const { conversations, activeId, selectConversation, newChat, deleteActive, exportAll, importFile } = useChatStore()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { importFile(file); e.target.value = '' }
  }

  return (
    <aside className="w-80 border-r border-[#1f2937] bg-[#111827] flex flex-col" role="navigation" aria-label="Danh sách hội thoại">
      <div className="flex gap-2 p-3 border-b border-[#1f2937] flex-wrap">
        <button onClick={newChat} className="px-2.5 py-2 rounded-xl border border-[#1f2937] bg-[#0f172a] text-sm cursor-pointer hover:border-[#334155]">+ New chat</button>
        <button onClick={exportAll} className="px-2.5 py-2 rounded-xl border border-[#1f2937] bg-[#0f172a] text-sm cursor-pointer hover:border-[#334155]">Export</button>
        <button onClick={() => fileRef.current?.click()} className="px-2.5 py-2 rounded-xl border border-[#1f2937] bg-[#0f172a] text-sm cursor-pointer hover:border-[#334155]">Import</button>
        <button onClick={deleteActive} className="px-2.5 py-2 rounded-xl border border-red-500/50 bg-[#0f172a] text-sm cursor-pointer">Xoá</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
      </div>

      <div className="flex-1 overflow-auto p-2">
        {conversations.length === 0 ? (
          <div className="text-[#9ca3af] text-sm p-3">Chưa có hội thoại. Bấm "New chat".</div>
        ) : (
          conversations
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <div key={c.id}
                onClick={() => selectConversation(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') { selectConversation(c.id) } }}
                role="button"
                tabIndex={0}
                aria-current={c.id === activeId ? 'true' : undefined}
                className={`flex flex-col gap-1.5 p-2.5 rounded-xl cursor-pointer border border-transparent mb-1
                  ${c.id === activeId ? 'border-[#334155] bg-white/4' : 'hover:bg-white/3'}`}
              >
                <div className="font-semibold truncate text-sm">{c.title || 'New chat'}</div>
                <div className="flex gap-2 text-xs text-[#9ca3af]">
                  <span>{c.messages.length} msg</span>
                  <span>•</span>
                  <span>{fmtTime(c.updatedAt)}</span>
                </div>
              </div>
            ))
        )}
      </div>
    </aside>
  )
}
