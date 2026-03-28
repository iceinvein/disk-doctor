import { Loader2 } from 'lucide-react'
import { useAppState } from '../state/context'
import { useScan } from '../hooks/useTauri'

export function ScanModal() {
  const { state } = useAppState()
  const { cancelScan } = useScan()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-overlay backdrop-blur-sm">
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 w-80 flex flex-col items-center border border-[var(--color-border)] shadow-2xl">
        <Loader2 size={32} className="text-[var(--color-accent)] animate-spin mb-5" />

        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
          Scanning…
        </h2>

        {state.scanProgress && (
          <div className="w-full mb-5 text-center">
            <p className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums mb-1">
              {state.scanProgress.scanned_count.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-3">items scanned</p>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate max-w-full px-2">
              {state.scanProgress.current_path}
            </p>
          </div>
        )}

        <button
          onClick={cancelScan}
          className="px-5 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
