import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppState } from '../state/context'
import { getCurrentEntries, sortEntries } from '../state/helpers'
import { FileRow } from './FileRow'
import type { SortField } from '../state/types'

export function FileList() {
  const { state, dispatch } = useAppState()
  const parentRef = useRef<HTMLDivElement>(null)

  const entries = useMemo(
    () =>
      sortEntries(
        getCurrentEntries(state.tree, state.currentPath),
        state.sortBy,
        state.sortDir,
      ),
    [state.tree, state.currentPath, state.sortBy, state.sortDir],
  )

  const maxSize = useMemo(
    () => entries.reduce((max, e) => Math.max(max, e.size), 0),
    [entries],
  )

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  function handleSort(field: SortField) {
    dispatch({ type: 'SET_SORT', field })
  }

  function sortIndicator(field: SortField): string {
    if (state.sortBy !== field) return ''
    return state.sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Empty folder
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Column headers */}
      <div className="flex items-center h-8 px-3 gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        {/* Spacer for checkbox + icon */}
        <div className="w-4 shrink-0" />
        <div className="w-4 shrink-0" />

        <button
          onClick={() => handleSort('name')}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] truncate min-w-0 flex-1 text-left cursor-pointer"
        >
          Name{sortIndicator('name')}
        </button>

        {/* Spacer for bar */}
        <div className="w-24 shrink-0" />

        <button
          onClick={() => handleSort('size')}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] w-16 text-right shrink-0 cursor-pointer"
        >
          Size{sortIndicator('size')}
        </button>
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          className="relative w-full"
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index]
            return (
              <div
                key={entry.path}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FileRow
                  entry={entry}
                  maxSize={maxSize}
                  isActive={state.activePath === entry.path}
                  isSelected={state.selectedPaths.has(entry.path)}
                  onActivate={() =>
                    dispatch({ type: 'SET_ACTIVE', path: entry.path })
                  }
                  onToggleSelect={() =>
                    dispatch({ type: 'TOGGLE_SELECTED', path: entry.path })
                  }
                  onNavigate={() =>
                    dispatch({ type: 'NAVIGATE_INTO', folderName: entry.name })
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
