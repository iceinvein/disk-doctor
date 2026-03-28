import { ChevronLeft, ChevronRight, HardDrive, FolderSearch, Search } from 'lucide-react'
import { useStore } from '../state/store'
import { useScan, useNavigation } from '../hooks/useTauri'

export function Toolbar() {
  const breadcrumbs = useStore(s => s.breadcrumbs)
  const searchQuery = useStore(s => s.searchQuery)
  const setSearchQuery = useStore(s => s.setSearchQuery)
  const { navigateBack, navigateToBreadcrumb } = useNavigation()
  const { scanFolder } = useScan()

  const showBack = breadcrumbs.length > 1
  // Breadcrumb segments (skip the root which gets its own icon)
  const segments = breadcrumbs.slice(1)
  const maxVisible = 5
  const truncated = segments.length > maxVisible
  const visibleSegments = truncated ? segments.slice(segments.length - maxVisible) : segments
  const indexOffset = truncated ? segments.length - maxVisible : 0

  return (
    <div className="h-10 flex items-center px-3 gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {showBack && (
        <button
          onClick={navigateBack}
          className="flex items-center gap-0.5 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors cursor-pointer shrink-0"
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
          <span className="text-xs font-medium">Back</span>
        </button>
      )}

      <nav className="flex items-center gap-0.5 text-sm min-w-0 flex-1 overflow-hidden" aria-label="Breadcrumb">
        <button
          onClick={() => navigateToBreadcrumb(0)}
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
          // actualIndex in the full breadcrumbs array (offset by 1 for root + indexOffset for truncation)
          const breadcrumbIndex = i + indexOffset + 1
          const isLast = breadcrumbIndex === breadcrumbs.length - 1
          return (
            <span key={breadcrumbIndex} className="flex items-center gap-0.5 min-w-0">
              <ChevronRight size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
              {isLast ? (
                <span className="text-xs text-[var(--color-text-primary)] font-medium truncate" aria-current="page">
                  {segment.name}
                </span>
              ) : (
                <button
                  onClick={() => navigateToBreadcrumb(breadcrumbIndex)}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] truncate cursor-pointer transition-colors"
                >
                  {segment.name}
                </button>
              )}
            </span>
          )
        })}
      </nav>

      <div className="relative shrink-0">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none" />
        <input
          id="search-filter-input"
          type="text"
          placeholder="Filter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-40 h-7 pl-6 pr-2 text-xs rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
      </div>

      <button
        onClick={scanFolder}
        title="Scan a new folder"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer shrink-0"
      >
        <FolderSearch size={13} />
        Scan
      </button>
    </div>
  )
}
