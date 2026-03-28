import { Folder, File, FileText, Image, Music, Archive, Link, Lock, Download, BookOpen, Monitor, FileCode } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DirEntry } from './types'

export type FileCategory = 'folder' | 'media' | 'audio' | 'archive' | 'code' | 'document' | 'system' | 'other'

export const CATEGORY_COLORS: Record<FileCategory, string> = {
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

export function getCategory(entry: DirEntry): FileCategory {
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

export function getCategoryColor(entry: DirEntry): string {
  return CATEGORY_COLORS[getCategory(entry)]
}

const FOLDER_ICONS: Record<string, LucideIcon> = {
  Downloads: Download,
  Library: BookOpen,
  Applications: Monitor,
  Desktop: Monitor,
  Documents: FileText,
}

export function getIcon(entry: DirEntry): LucideIcon {
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
