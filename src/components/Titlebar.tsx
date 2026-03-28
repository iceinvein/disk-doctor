export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="h-12 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center justify-center shrink-0 select-none"
    >
      {/* Leave space for macOS traffic lights */}
      <div className="w-16" />

      <span
        data-tauri-drag-region
        className="flex-1 text-center text-sm font-medium text-[var(--color-accent-light)]"
      >
        Disk Doctor
      </span>

      {/* Balance the layout */}
      <div className="w-16" />
    </div>
  )
}
