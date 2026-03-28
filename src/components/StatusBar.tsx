import { useState, useMemo } from 'react'
import { useAppState } from '../state/context'
import { getCurrentEntries, findEntry, formatSize } from '../state/helpers'
import { useTrash } from '../hooks/useTauri'
import { ConfirmDialog } from './ConfirmDialog'

export function StatusBar() {
  const { state } = useAppState()
  const { trashItems } = useTrash()
  const [showConfirm, setShowConfirm] = useState(false)

  const entries = getCurrentEntries(state.tree, state.currentPath)
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
  const itemCount = entries.length

  const scanTimeSeconds =
    state.scanTime !== null ? (state.scanTime / 1000).toFixed(1) : null

  const selectedCount = state.selectedPaths.size

  const selectedSize = useMemo(() => {
    if (selectedCount === 0) return 0
    let total = 0
    for (const path of state.selectedPaths) {
      const entry = findEntry(state.tree, path)
      if (entry) total += entry.size
    }
    return total
  }, [state.selectedPaths, state.tree, selectedCount])

  async function handleBatchTrash() {
    setShowConfirm(false)
    const paths = Array.from(state.selectedPaths)
    await trashItems(paths)
  }

  return (
    <div className="h-8 flex items-center justify-between px-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {/* Left info */}
      <span className="text-xs text-[var(--color-text-secondary)]">
        {itemCount.toLocaleString()} items &middot; {formatSize(totalSize)}
        {scanTimeSeconds !== null && (
          <> &middot; Scanned in {scanTimeSeconds}s</>
        )}
      </span>

      {/* Right: batch trash */}
      {selectedCount > 0 && (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-xs text-[var(--color-danger)] hover:opacity-80 transition-opacity cursor-pointer"
        >
          🗑 Trash {selectedCount} selected ({formatSize(selectedSize)})
        </button>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="Trash Selected Items"
          message={`Are you sure you want to move ${selectedCount} item${selectedCount !== 1 ? 's' : ''} (${formatSize(selectedSize)}) to the trash?`}
          confirmLabel="Move to Trash"
          onConfirm={handleBatchTrash}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
