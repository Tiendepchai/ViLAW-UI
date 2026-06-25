import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#0b0f19] text-[#e5e7eb] p-8">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">Đã xảy ra lỗi</h2>
            <p className="text-[#9ca3af] text-sm mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 rounded-lg border border-[#1f2937] bg-[#111827] cursor-pointer hover:border-[#334155]"
            >
              Thử lại
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
