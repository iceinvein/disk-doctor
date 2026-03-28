import { useAppState } from '../state/context'

export function Titlebar() {
  const { state, dispatch } = useAppState()

  return (
    <div
      data-tauri-drag-region
      className="h-12 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]
                 flex items-center px-4 select-none shrink-0"
    >
      {/* macOS traffic light spacer */}
      <div className="w-16 shrink-0" />

      <span
        data-tauri-drag-region
        className="flex-1 text-center text-sm font-semibold text-[var(--color-accent-light)]"
      >
        Disk Doctor
      </span>

      {state.tree ? (
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                     cursor-pointer transition-colors w-16 text-right"
        >
          New Scan
        </button>
      ) : (
        <div className="w-16" />
      )}
    </div>
  )
}
