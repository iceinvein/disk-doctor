import { useState, useMemo, useEffect, useRef } from 'react'
import { Trash2, Loader2, XCircle, CheckCircle2 } from 'lucide-react'
import { useStore } from '../state/store'
import { formatSize } from '../state/helpers'
import { useTrash, useScan } from '../hooks/useTauri'
import { ConfirmDialog } from './ConfirmDialog'

export function StatusBar() {
  const viewEntries = useStore(s => s.viewEntries)
  const selectedPaths = useStore(s => s.selectedPaths)
  const scanning = useStore(s => s.scanning)
  const scanProgress = useStore(s => s.scanProgress)
  const scanTime = useStore(s => s.scanTime)
  const { trashItems } = useTrash()
  const { cancelScan } = useScan()
  const [showConfirm, setShowConfirm] = useState(false)

  // Elapsed time counter during scan
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (scanning) {
      setElapsed(0)
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [scanning])

  // Scan completion highlight — true for 4s after scan finishes
  const [scanJustCompleted, setScanJustCompleted] = useState(false)
  useEffect(() => {
    if (!scanning && scanTime !== null) {
      setScanJustCompleted(true)
      const timer = setTimeout(() => setScanJustCompleted(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [scanning, scanTime])

  const totalSize = useMemo(
    () => viewEntries.reduce((sum, e) => sum + e.size, 0),
    [viewEntries],
  )
  const selectedCount = selectedPaths.size

  const selectedSize = useMemo(() => {
    if (selectedCount === 0) return 0
    let total = 0
    for (const path of selectedPaths) {
      const entry = viewEntries.find((e) => e.path === path)
      if (entry) total += entry.size
    }
    return total
  }, [selectedPaths, viewEntries, selectedCount])

  async function handleBatchTrash() {
    setShowConfirm(false)
    await trashItems(Array.from(selectedPaths))
  }

  return (
    <div className="h-8 flex items-center justify-between px-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
      {/* Left: scan progress or item count */}
      {scanning ? (
        <span className="flex items-center gap-2 text-xs text-[var(--color-accent)]">
          <Loader2 size={12} className="animate-spin" />
          Scanning… {scanProgress ? `${scanProgress.scanned_count.toLocaleString()} items` : ''}{elapsed > 0 ? ` · ${elapsed}s` : ''}
        </span>
      ) : scanJustCompleted ? (
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-success)] scan-complete-highlight">
          <CheckCircle2 size={12} />
          Scan complete — {viewEntries.length.toLocaleString()} items, {formatSize(totalSize)}{scanTime !== null ? `, ${scanTime.toFixed(1)}s` : ''}
        </span>
      ) : (
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {viewEntries.length.toLocaleString()} items · {formatSize(totalSize)}
          {scanTime !== null && ` · ${scanTime.toFixed(1)}s`}
        </span>
      )}

      {/* Right: cancel scan, batch trash, or nothing */}
      {scanning ? (
        <button
          onClick={cancelScan}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer btn-press"
        >
          <XCircle size={12} />
          Cancel
        </button>
      ) : selectedCount > 0 ? (
        <button
          data-batch-trash
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
          message={`Move ${selectedCount} item${selectedCount !== 1 ? 's' : ''} (${formatSize(selectedSize)}) to the Trash? You can recover them from the Trash later.`}
          confirmLabel="Move to Trash"
          onConfirm={handleBatchTrash}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
