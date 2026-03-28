import { RotateCcw } from 'lucide-react'
import { useStore } from '../state/store'

export function Titlebar() {
  const rootPath = useStore(s => s.rootPath)
  const reset = useStore(s => s.reset)

  return (
    <div
      data-tauri-drag-region
      className="h-11 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex items-center justify-end px-4 select-none shrink-0"
    >
      {rootPath && (
        <button
          onClick={reset}
          title="Start a new scan"
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
        >
          <RotateCcw size={12} />
          New
        </button>
      )}
    </div>
  )
}
