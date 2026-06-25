import type { Citation } from '../types/chat'

type CitationLike = Record<string, unknown>

function getTag(c: CitationLike, idx: number) { return String(c?.tag ?? c?.id ?? `C${idx + 1}`) }
function getTitle(c: CitationLike) { return String(c?.title ?? c?.meta?.tieu_de_dieu ?? c?.meta?.so_dieu ?? c?.meta?.id ?? 'Trích dẫn') }
function getUrl(c: CitationLike) { return c?.url ? String(c.url) : '' }
function getText(c: CitationLike) { return String(c?.text ?? c?.content ?? c?.noi_dung ?? c?.meta?.noi_dung ?? c?.snippet ?? c?.passage ?? '') }

interface Props {
  citations: Citation[]
  messageId: string
  isOpen: boolean
  onToggle: () => void
}

export function CitationPanel({ citations, messageId, isOpen, onToggle }: Props) {
  if (!citations?.length) return null

  const items = citations as unknown as CitationLike[]

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 bg-transparent border border-white/15 text-inherit px-2.5 py-1.5 rounded-xl cursor-pointer text-xs hover:border-white/30"
      >
        {isOpen ? '▾' : '▸'} Trích dẫn ({items.length})
      </button>

      {isOpen && (
        <div className="mt-2 max-h-60 overflow-auto pl-2.5 border-l-2 border-white/8">
          {items.map((c, idx) => {
            const tag = getTag(c, idx)
            const title = getTitle(c)
            const url = getUrl(c)
            const text = getText(c)
            return (
              <details key={`${messageId}-${tag}-${idx}`} className="py-2 text-xs text-[#9ca3af]" open={idx === 0}>
                <summary className="cursor-pointer opacity-95 hover:opacity-100">
                  <b>[{tag}]</b>{' '}
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="text-blue-300 no-underline hover:underline">
                      {title}
                    </a>
                  ) : (
                    <span>{title}</span>
                  )}
                </summary>
                {text && <div className="whitespace-pre-wrap leading-relaxed opacity-90 pt-1.5">{text}</div>}
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
