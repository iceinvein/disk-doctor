import { useState, useMemo } from 'react'
import { Trash2, Loader2, XCircle } from 'lucide-react'
import { useAppState } from '../state/context'
import { getCurrentEntries, findEntry, formatSize } from '../state/helpers'
import { useTrash, useScan } from '../hooks/useTauri'
import { ConfirmDialog } from './ConfirmDialog'

export function StatusBar() {
  const { state } = useAppState()
  const { trashItems } = useTrash()
  const { cancelScan } = useScan()
  const [showConfirm, setShowConfirm] = useState(false)

  const entries = getCurrentEntries(state.tree, state.currentPath)
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
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
    await trashItems(Array.from(state.selectedPaths))
  }

  return (
    <div className="h-8 flex items-center justify-between px-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {/* Left: scan progress or item count */}
      {state.scanning ? (
        <span className="flex items-center gap-2 text-xs text-[var(--color-accent)]">
          <Loader2 size={12} className="animate-spin" />
          Scanning… {state.scanProgress ? `${state.scanProgress.scanned_count.toLocaleString()} items found` : ''}
        </span>
      ) : (
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {entries.length.toLocaleString()} items · {formatSize(totalSize)}
          {state.scanTime !== null && ` · Scanned in ${state.scanTime.toFixed(1)}s`}
        </span>
      )}

      {/* Right: cancel scan, batch trash, or nothing */}
      {state.scanning ? (
        <button
          onClick={cancelScan}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          <XCircle size={12} />
          Cancel
        </button>
      ) : selectedCount > 0 ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-danger)] hover:brightness-125 transition-all cursor-pointer"
        >
          <Trash2 size={12} />
          Trash {selectedCount} selected ({formatSize(selectedSize)})
        </button>
      ) : null}

      {showConfirm && (
        <ConfirmDialog
          title="Trash Selected Items"
          message={`Move ${selectedCount} item${selectedCount !== 1 ? 's' : ''} (${formatSize(selectedSize)}) to the Trash?`}
          confirmLabel="Move to Trash"
          onConfirm={handleBatchTrash}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
