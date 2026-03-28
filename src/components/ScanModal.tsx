import { useAppState } from '../state/context'
import { useScan } from '../hooks/useTauri'

export function ScanModal() {
  const { state } = useAppState()
  const { cancelScan } = useScan()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 w-80 flex flex-col items-center border border-[var(--color-border)]">
        {/* CSS spinner */}
        <div className="w-10 h-10 border-3 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin mb-6" />

        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Scanning...
        </h2>

        {state.scanProgress && (
          <div className="w-full mb-4 text-center">
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">
              {state.scanProgress.scanned_count.toLocaleString()} items scanned
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate max-w-full">
              {state.scanProgress.current_path}
            </p>
          </div>
        )}

        <button
          onClick={cancelScan}
          className="px-5 py-2 rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
