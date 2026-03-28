import { ChevronRight } from 'lucide-react'
import type { DirEntry } from '../state/types'
import { formatSize } from '../state/helpers'
import { getCategory, getIcon, CATEGORY_COLORS } from '../state/categories'

type FileRowProps = {
  entry: DirEntry
  maxSize: number
  isActive: boolean
  isSelected: boolean
  onActivate: () => void
  onToggleSelect: () => void
  onNavigate: () => void
  onContextMenu: (pos: { x: number; y: number }) => void
}

export function FileRow({
  entry,
  maxSize,
  isActive,
  isSelected,
  onActivate,
  onToggleSelect,
  onNavigate,
  onContextMenu,
}: FileRowProps) {
  const barWidth = maxSize > 0 ? (entry.size / maxSize) * 100 : 0
  const category = getCategory(entry)
  const color = CATEGORY_COLORS[category]
  const Icon = getIcon(entry)

  return (
    <div
      className={`flex items-center h-12 px-3 gap-3 cursor-pointer transition-all duration-100 ${
        isActive
          ? 'bg-[var(--color-bg-selected)] border-l-2 border-l-[var(--color-accent)]'
          : 'border-l-2 border-l-transparent hover:bg-[var(--color-bg-hover)]'
      }`}
      onClick={onActivate}
      onDoubleClick={() => {
        if (entry.is_dir) onNavigate()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation()
          onToggleSelect()
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 shrink-0 accent-[var(--color-accent)] cursor-pointer rounded"
      />

      <Icon size={18} style={{ color }} className="shrink-0" />

      <span className="text-sm truncate min-w-0 flex-1">
        {entry.is_dir ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNavigate()
            }}
            title={entry.name}
            className="text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer text-left"
          >
            {entry.name}
          </button>
        ) : (
          <span className="text-[var(--color-text-primary)]">{entry.name}</span>
        )}
        {entry.is_restricted && (
          <span className="text-xs text-[var(--color-text-tertiary)] ml-1.5" title="Permission denied — cannot read this folder">
            restricted
          </span>
        )}
      </span>

      <div className="w-28 h-1.5 rounded-full bg-[var(--color-bg-primary)] shrink-0 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>

      <span className="text-xs text-[var(--color-text-secondary)] w-16 text-right shrink-0 tabular-nums">
        {formatSize(entry.size)}
      </span>

      {entry.is_dir ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNavigate()
          }}
          className="shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
          aria-label={`Open ${entry.name}`}
        >
          <ChevronRight size={14} />
        </button>
      ) : (
        <div className="w-3.5 shrink-0" />
      )}
    </div>
  )
}
