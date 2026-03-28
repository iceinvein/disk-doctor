import { RotateCcw } from 'lucide-react'
import { useAppState } from '../state/context'

export function Titlebar() {
  const { state, dispatch } = useAppState()

  return (
    <div
      data-tauri-drag-region
      className="h-11 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex items-center justify-end px-4 select-none shrink-0"
    >
      {state.tree && (
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
        >
          <RotateCcw size={12} />
          New
        </button>
      )}
    </div>
  )
}
