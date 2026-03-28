import { useRef, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../state/store'
import { sortEntries } from '../state/helpers'
import { useNavigation, useTrash } from '../hooks/useTauri'
import { FileRow } from './FileRow'
import { Hint } from './Hint'
import { ContextMenu } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'
import { formatSize } from '../state/helpers'
import type { DirEntry, SortField } from '../state/types'

type ContextMenuState = {
  entry: DirEntry
  x: number
  y: number
} | null

export function FileList() {
  const viewEntries = useStore(s => s.viewEntries)
  const breadcrumbs = useStore(s => s.breadcrumbs)
  const sortBy = useStore(s => s.sortBy)
  const sortDir = useStore(s => s.sortDir)
  const activePath = useStore(s => s.activePath)
  const selectedPaths = useStore(s => s.selectedPaths)
  const setActive = useStore(s => s.setActive)
  const toggleSelected = useStore(s => s.toggleSelected)
  const setSort = useStore(s => s.setSort)
  const searchQuery = useStore(s => s.searchQuery)
  const parentRef = useRef<HTMLDivElement>(null)

  const scanning = useStore(s => s.scanning)
  const { navigateInto } = useNavigation()
  const { trashItems } = useTrash()

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [trashConfirm, setTrashConfirm] = useState<DirEntry | null>(null)

  const sorted = useMemo(() => {
    // Skip client-side sort during scanning — Rust already sorts by size desc
    if (scanning) return viewEntries
    return sortEntries(viewEntries, sortBy, sortDir)
  }, [viewEntries, sortBy, sortDir, scanning])

  const entries = useMemo(() => {
    if (!searchQuery) return sorted
    const q = searchQuery.toLowerCase()
    return sorted.filter(e => e.name.toLowerCase().includes(q))
  }, [sorted, searchQuery])

  const handleContextMenuTrash = useCallback((entry: DirEntry) => {
    setTrashConfirm(entry)
  }, [])

  const handleConfirmTrash = useCallback(async () => {
    if (!trashConfirm) return
    setTrashConfirm(null)
    await trashItems([trashConfirm.path])
  }, [trashConfirm, trashItems])

  const maxSize = useMemo(
    () => entries.reduce((max, e) => Math.max(max, e.size), 0),
    [entries],
  )

  // Use breadcrumb path as key to reset virtualizer scroll on navigation
  const viewKey = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].path : ''

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  function handleSort(field: SortField) {
    setSort(field)
  }

  function sortIndicator(field: SortField): string {
    if (sortBy !== field) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          No items in this folder
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          Go back to explore other folders
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" key={viewKey}>
      {/* Column headers */}
      <div className="flex items-center h-8 px-3 gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        {/* Spacer for checkbox + icon */}
        <div className="w-4 shrink-0" />
        <div className="w-4 shrink-0" />

        <button
          onClick={() => handleSort('name')}
          className={`text-xs font-medium truncate min-w-0 flex-1 text-left cursor-pointer hover:text-[var(--color-text-primary)] ${
            sortBy === 'name' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
          }`}
        >
          Name{sortIndicator('name')}
        </button>

        {/* Spacer for bar */}
        <div className="w-28 shrink-0" />

        <button
          onClick={() => handleSort('size')}
          className={`text-xs font-medium w-16 text-right shrink-0 cursor-pointer hover:text-[var(--color-text-primary)] ${
            sortBy === 'size' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
          }`}
        >
          Size{sortIndicator('size')}
        </button>

        {/* Spacer for chevron */}
        <div className="w-3.5 shrink-0" />
      </div>

      {/* First-use hint */}
      {!scanning && entries.some(e => e.is_dir) && (
        <div className="px-3 py-1.5 shrink-0">
          <Hint id="folder-nav">
            Click a folder name to explore inside. Right-click for more options. Press <kbd className="font-semibold">?</kbd> for keyboard shortcuts.
          </Hint>
        </div>
      )}

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-auto nav-transition">
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
                  isActive={activePath === entry.path}
                  isSelected={selectedPaths.has(entry.path)}
                  onActivate={() => setActive(entry.path)}
                  onToggleSelect={() => toggleSelected(entry.path)}
                  onNavigate={() => navigateInto(entry)}
                  onContextMenu={(pos) => setContextMenu({ entry, x: pos.x, y: pos.y })}
                />
              </div>
            )
          })}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={() => setContextMenu(null)}
          onNavigate={() => navigateInto(contextMenu.entry)}
          onTrash={() => handleContextMenuTrash(contextMenu.entry)}
        />
      )}

      {trashConfirm && (
        <ConfirmDialog
          title="Move to Trash"
          message={`"${trashConfirm.name}" (${formatSize(trashConfirm.size)}) will be moved to the Trash. You can recover it from the Trash later.`}
          confirmLabel="Move to Trash"
          onConfirm={handleConfirmTrash}
          onCancel={() => setTrashConfirm(null)}
        />
      )}
    </div>
  )
}
