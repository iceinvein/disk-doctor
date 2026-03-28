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

export type AppState = {
  tree: DirEntry | null
  currentPath: string[]
  selectedPaths: Set<string>
  activePath: string | null
  sortBy: SortField
  sortDir: SortDir
  scanning: boolean
  scanProgress: ScanProgress | null
  scanTime: number | null
  error: string | null
}

export type Action =
  | { type: 'SET_TREE'; tree: DirEntry; scanTime: number }
  | { type: 'SET_SCANNING'; scanning: boolean }
  | { type: 'SET_SCAN_PROGRESS'; progress: ScanProgress }
  | { type: 'NAVIGATE_INTO'; folderName: string }
  | { type: 'NAVIGATE_TO_BREADCRUMB'; index: number }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'SET_ACTIVE'; path: string | null }
  | { type: 'TOGGLE_SELECTED'; path: string }
  | { type: 'SELECT_ALL' }
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_SORT'; field: SortField }
  | { type: 'REMOVE_PATHS'; paths: string[] }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' }
