import type { DirEntry } from '../state/types'
import { formatSize } from '../state/helpers'

type FileRowProps = {
  entry: DirEntry
  maxSize: number
  isActive: boolean
  isSelected: boolean
  onActivate: () => void
  onToggleSelect: () => void
  onNavigate: () => void
}

const EXT_ICONS: Record<string, string> = {
  '.jpg': '🖼️',
  '.jpeg': '🖼️',
  '.png': '🖼️',
  '.gif': '🖼️',
  '.svg': '🖼️',
  '.webp': '🖼️',
  '.mp4': '🎬',
  '.mov': '🎬',
  '.avi': '🎬',
  '.mkv': '🎬',
  '.mp3': '🎵',
  '.wav': '🎵',
  '.flac': '🎵',
  '.aac': '🎵',
  '.zip': '📦',
  '.tar': '📦',
  '.gz': '📦',
  '.rar': '📦',
  '.7z': '📦',
  '.pdf': '📄',
  '.dmg': '💿',
  '.iso': '💿',
}

const FOLDER_ICONS: Record<string, string> = {
  node_modules: '📦',
  '.git': '🔀',
  Downloads: '⬇️',
  Library: '📚',
  Applications: '🚀',
  Desktop: '🖥️',
  Documents: '📝',
  Pictures: '🖼️',
  Music: '🎵',
  Movies: '🎬',
}

function fileIcon(entry: DirEntry): string {
  if (entry.is_symlink) return '🔗'
  if (entry.is_restricted) return '🔒'

  if (entry.is_dir) {
    return FOLDER_ICONS[entry.name] ?? '📁'
  }

  const dotIndex = entry.name.lastIndexOf('.')
  if (dotIndex !== -1) {
    const ext = entry.name.slice(dotIndex).toLowerCase()
    if (ext in EXT_ICONS) return EXT_ICONS[ext]
  }

  return '📄'
}

export function FileRow({
  entry,
  maxSize,
  isActive,
  isSelected,
  onActivate,
  onToggleSelect,
  onNavigate,
}: FileRowProps) {
  const barWidth = maxSize > 0 ? (entry.size / maxSize) * 100 : 0

  return (
    <div
      className={`flex items-center h-12 px-3 gap-3 cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--color-bg-selected)] border-l-2 border-l-[var(--color-accent)]'
          : 'hover:bg-[var(--color-bg-hover)]'
      }`}
      onClick={onActivate}
      onDoubleClick={() => {
        if (entry.is_dir) onNavigate()
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation()
          onToggleSelect()
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 shrink-0 accent-[var(--color-accent)] cursor-pointer"
      />

      {/* Icon */}
      <span className="text-base shrink-0" role="img" aria-hidden="true">
        {fileIcon(entry)}
      </span>

      {/* Name */}
      <span className="text-sm text-[var(--color-text-primary)] truncate min-w-0 flex-1">
        {entry.name}
        {entry.is_restricted && (
          <span className="text-xs text-[var(--color-text-secondary)] ml-1">
            (restricted)
          </span>
        )}
      </span>

      {/* Proportional bar */}
      <div className="w-24 h-2 rounded-full bg-[var(--color-bg-tertiary)] shrink-0 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Size */}
      <span className="text-xs text-[var(--color-text-secondary)] w-16 text-right shrink-0 tabular-nums">
        {formatSize(entry.size)}
      </span>
    </div>
  )
}
