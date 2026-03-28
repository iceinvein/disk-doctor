export type DirEntry = {
  path: string
  name: string
  size: number
  is_dir: boolean
  child_count: number
  modified: number
  is_symlink: boolean
  is_restricted: boolean
  children: DirEntry[]
}

export type ViewUpdate = {
  entries: DirEntry[]
  parent_path: string
  parent_size: number
  parent_name: string
  total_scanned: number
}

export type BreadcrumbSegment = {
  name: string
  path: string
}

export type ScanProgress = {
  scanned_count: number
  current_path: string
}

export type DiskUsage = {
  total: number
  free: number
  used: number
}

export type SortField = 'size' | 'name' | 'modified'
export type SortDir = 'asc' | 'desc'
