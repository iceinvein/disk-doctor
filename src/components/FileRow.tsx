import { Folder, File, FileText, Image, Music, Archive, Link, Lock, Download, BookOpen, Monitor, FileCode, type LucideIcon } from 'lucide-react'
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

type FileCategory = 'folder' | 'media' | 'audio' | 'archive' | 'code' | 'document' | 'system' | 'other'

const CATEGORY_COLORS: Record<FileCategory, string> = {
  folder: 'var(--color-cat-folder)',
  media: 'var(--color-cat-media)',
  audio: 'var(--color-cat-audio)',
  archive: 'var(--color-cat-archive)',
  code: 'var(--color-cat-code)',
  document: 'var(--color-cat-document)',
  system: 'var(--color-cat-system)',
  other: 'var(--color-cat-other)',
}

const MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'])
const ARCHIVE_EXTS = new Set(['.zip', '.tar', '.gz', '.rar', '.7z', '.dmg', '.iso', '.bz2', '.xz'])
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.yaml', '.yml', '.toml', '.xml', '.sh', '.rb', '.php', '.swift', '.kt'])
const DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.pages', '.xls', '.xlsx', '.ppt', '.pptx', '.csv'])

function getCategory(entry: DirEntry): FileCategory {
  if (entry.is_dir) {
    if (entry.name.startsWith('.')) return 'system'
    return 'folder'
  }
  const dotIndex = entry.name.lastIndexOf('.')
  if (dotIndex === -1) return 'other'
  const ext = entry.name.slice(dotIndex).toLowerCase()
  if (MEDIA_EXTS.has(ext)) return 'media'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (ARCHIVE_EXTS.has(ext)) return 'archive'
  if (CODE_EXTS.has(ext)) return 'code'
  if (DOC_EXTS.has(ext)) return 'document'
  if (entry.name.startsWith('.')) return 'system'
  return 'other'
}

const FOLDER_ICONS: Record<string, LucideIcon> = {
  Downloads: Download,
  Library: BookOpen,
  Applications: Monitor,
  Desktop: Monitor,
  Documents: FileText,
}

function getIcon(entry: DirEntry): LucideIcon {
  if (entry.is_symlink) return Link
  if (entry.is_restricted) return Lock
  if (entry.is_dir) return FOLDER_ICONS[entry.name] ?? Folder

  const cat = getCategory(entry)
  switch (cat) {
    case 'media': return Image
    case 'audio': return Music
    case 'archive': return Archive
    case 'code': return FileCode
    case 'document': return FileText
    default: return File
  }
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

      <span className="text-sm text-[var(--color-text-primary)] truncate min-w-0 flex-1">
        {entry.name}
        {entry.is_restricted && (
          <span className="text-xs text-[var(--color-text-tertiary)] ml-1.5">
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
    </div>
  )
}
