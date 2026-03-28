import { ChevronLeft, ChevronRight, HardDrive, FolderSearch } from 'lucide-react'
import { useAppState } from '../state/context'
import { useScan } from '../hooks/useTauri'

export function Toolbar() {
  const { state, dispatch } = useAppState()
  const { scanFolder } = useScan()

  const segments = state.currentPath
  const showBack = segments.length > 0
  const maxVisible = 5
  const truncated = segments.length > maxVisible
  const visibleSegments = truncated ? segments.slice(segments.length - maxVisible) : segments
  const indexOffset = truncated ? segments.length - maxVisible : 0

  return (
    <div className="h-10 flex items-center px-3 gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {showBack && (
        <button
          onClick={() => dispatch({ type: 'NAVIGATE_BACK' })}
          className="flex items-center gap-0.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors cursor-pointer shrink-0"
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
          <span className="text-xs font-medium">Back</span>
        </button>
      )}

      <nav className="flex items-center gap-0.5 text-sm min-w-0 flex-1 overflow-hidden" aria-label="Breadcrumb">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE_TO_BREADCRUMB', index: 0 })}
          className="shrink-0 cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Root directory"
        >
          <HardDrive size={14} />
        </button>

        {truncated && (
          <>
            <ChevronRight size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
            <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">&hellip;</span>
          </>
        )}

        {visibleSegments.map((segment, i) => {
          const actualIndex = i + indexOffset + 1
          const isLast = actualIndex === segments.length
          return (
            <span key={actualIndex} className="flex items-center gap-0.5 min-w-0">
              <ChevronRight size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
              {isLast ? (
                <span className="text-xs text-[var(--color-text-primary)] font-medium truncate" aria-current="page">
                  {segment}
                </span>
              ) : (
                <button
                  onClick={() => dispatch({ type: 'NAVIGATE_TO_BREADCRUMB', index: actualIndex })}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] truncate cursor-pointer transition-colors"
                >
                  {segment}
                </button>
              )}
            </span>
          )
        })}
      </nav>

      <button
        onClick={scanFolder}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer shrink-0"
      >
        <FolderSearch size={13} />
        Scan
      </button>
    </div>
  )
}
