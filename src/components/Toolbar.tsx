import { useAppState } from '../state/context'
import { useScan } from '../hooks/useTauri'

export function Toolbar() {
  const { state, dispatch } = useAppState()
  const { scanFolder } = useScan()

  const segments = state.currentPath
  const showBack = segments.length > 0

  // Truncate breadcrumb if more than 5 segments
  const maxVisible = 5
  const truncated = segments.length > maxVisible
  const visibleSegments = truncated
    ? segments.slice(segments.length - maxVisible)
    : segments
  const indexOffset = truncated ? segments.length - maxVisible : 0

  return (
    <div className="h-10 flex items-center px-3 gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {/* Back button */}
      {showBack && (
        <button
          onClick={() => dispatch({ type: 'NAVIGATE_BACK' })}
          className="text-sm text-[var(--color-accent)] hover:opacity-80 transition-opacity cursor-pointer shrink-0"
        >
          &larr; Back
        </button>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm min-w-0 flex-1 overflow-hidden">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE_TO_BREADCRUMB', index: 0 })}
          className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="Root"
        >
          💾
        </button>

        {truncated && (
          <>
            <span className="text-[var(--color-text-secondary)] shrink-0">›</span>
            <span className="text-xs text-[var(--color-text-secondary)] shrink-0">
              ...
            </span>
          </>
        )}

        {visibleSegments.map((segment, i) => {
          const actualIndex = i + indexOffset + 1 // +1 because index 0 is root
          const isLast = actualIndex === segments.length
          return (
            <span key={actualIndex} className="flex items-center gap-1 min-w-0">
              <span className="text-[var(--color-text-secondary)] shrink-0">
                ›
              </span>
              {isLast ? (
                <span className="text-[var(--color-text-primary)] font-semibold truncate">
                  {segment}
                </span>
              ) : (
                <button
                  onClick={() =>
                    dispatch({
                      type: 'NAVIGATE_TO_BREADCRUMB',
                      index: actualIndex,
                    })
                  }
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] truncate cursor-pointer transition-colors"
                >
                  {segment}
                </button>
              )}
            </span>
          )
        })}
      </div>

      {/* Scan button */}
      <button
        onClick={scanFolder}
        className="px-3 py-1 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shrink-0"
      >
        Scan Folder
      </button>
    </div>
  )
}
