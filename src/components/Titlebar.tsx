import { RotateCcw } from 'lucide-react'
import { useAppState } from '../state/context'

export function Titlebar() {
  const { state, dispatch } = useAppState()

  return (
    <div
      data-tauri-drag-region
      className="h-11 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex items-center px-4 select-none shrink-0"
    >
      <div className="w-16 shrink-0" />

      <span
        data-tauri-drag-region
        className="flex-1 text-center text-[13px] font-medium text-[var(--color-text-secondary)]"
      >
        Disk Doctor
      </span>

      {state.tree ? (
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors w-16 justify-end"
        >
          <RotateCcw size={12} />
          New
        </button>
      ) : (
        <div className="w-16" />
      )}
    </div>
  )
}
