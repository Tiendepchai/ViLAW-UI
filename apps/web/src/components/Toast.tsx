import { useChatStore } from '../stores/chatStore'

export function Toast() {
  const { toast, setToast } = useChatStore()
  if (!toast) return null

  return (
    <div
      onClick={() => setToast(null)}
      role="button"
      title="Bấm để đóng"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#111827] border border-[#1f2937] px-3 py-2.5 rounded-xl text-sm max-w-[90vw] cursor-pointer z-50 shadow-lg"
    >
      {toast}
    </div>
  )
}
