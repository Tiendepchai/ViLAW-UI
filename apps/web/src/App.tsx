import { useEffect } from 'react'
import { useChatStore } from './stores/chatStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { Toast } from './components/Toast'

export default function App() {
  const init = useChatStore((s) => s.init)

  useEffect(() => { init() }, [init])

  return (
    <ErrorBoundary>
      <div className="grid grid-cols-[320px_1fr] h-screen bg-[#0b0f19] text-[#e5e7eb] max-md:grid-cols-1">
        <div className="max-md:hidden">
          <Sidebar />
        </div>
        <main className="flex flex-col min-w-0 overflow-hidden">
          <ChatView />
          <Composer />
        </main>
      </div>
      <Toast />
    </ErrorBoundary>
  )
}
