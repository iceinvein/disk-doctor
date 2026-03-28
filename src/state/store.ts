import { create } from 'zustand'
import type { BreadcrumbSegment, DirEntry, ScanProgress, SortField, ViewUpdate } from './types'

type AppStore = {
  // View state — flat list of current folder's children
  viewEntries: DirEntry[]
  parentSize: number
  rootPath: string | null
  rootName: string | null
  currentScanId: number | null
  breadcrumbs: BreadcrumbSegment[]

  // Selection
  selectedPaths: Set<string>
  activePath: string | null

  // Sort
  sortBy: SortField
  sortDir: 'asc' | 'desc'

  // Scan
  scanning: boolean
  scanProgress: ScanProgress | null
  scanTime: number | null

  // UI
  error: string | null
  showPermissionGuide: boolean
  searchQuery: string
  showShortcuts: boolean

  // Actions
  initScan: (rootPath: string, rootName: string) => void
  setViewUpdate: (update: ViewUpdate) => void
  setViewEntries: (entries: DirEntry[], parentSize: number) => void
  setScanComplete: (scanTime: number) => void
  setScanProgress: (progress: ScanProgress) => void
  setScanning: (scanning: boolean) => void
  setBreadcrumbs: (breadcrumbs: BreadcrumbSegment[]) => void
  setActive: (path: string | null) => void
  toggleSelected: (path: string) => void
  selectAll: () => void
  deselectAll: () => void
  setSort: (field: SortField) => void
  removePaths: (paths: string[]) => void
  setError: (error: string | null) => void
  showPermission: (show: boolean) => void
  setSearchQuery: (query: string) => void
  toggleShortcuts: () => void
  reset: () => void
}

const initialState = {
  viewEntries: [] as DirEntry[],
  parentSize: 0,
  rootPath: null as string | null,
  rootName: null as string | null,
  currentScanId: null as number | null,
  breadcrumbs: [] as BreadcrumbSegment[],
  selectedPaths: new Set<string>(),
  activePath: null as string | null,
  sortBy: 'size' as SortField,
  sortDir: 'desc' as 'asc' | 'desc',
  scanning: false,
  scanProgress: null as ScanProgress | null,
  scanTime: null as number | null,
  error: null as string | null,
  showPermissionGuide: false,
  searchQuery: '',
  showShortcuts: false,
}

export const useStore = create<AppStore>((set, get) => ({
  ...initialState,

  initScan: (rootPath, rootName) =>
    set({
      rootPath,
      rootName,
      currentScanId: null,
      viewEntries: [],
      parentSize: 0,
      breadcrumbs: [{ name: rootName, path: rootPath }],
      scanning: true,
      scanProgress: null,
      scanTime: null,
      selectedPaths: new Set(),
      activePath: null,
      error: null,
      showPermissionGuide: false,
    }),

  setViewUpdate: (update) => {
    // During scanning, only apply if the update matches our current view
    const { breadcrumbs } = get()
    const currentViewPath = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].path : ''
    if (currentViewPath && update.parent_path !== currentViewPath) {
      console.log(
        `[store] skipping view-update for '${update.parent_path}' (current view: '${currentViewPath}')`,
      )
      return
    }
    console.log(
      `[store] applying view-update: ${update.entries.length} entries, parent='${update.parent_name}', parent_size=${update.parent_size}`,
    )
    set({ viewEntries: update.entries, parentSize: update.parent_size })
  },

  setViewEntries: (entries, parentSize) =>
    set({
      viewEntries: entries,
      parentSize,
      selectedPaths: new Set(),
      activePath: null,
    }),

  setScanComplete: (scanTime) =>
    set({ scanning: false, scanTime, scanProgress: null }),

  setScanning: (scanning) =>
    set({ scanning, scanProgress: scanning ? get().scanProgress : null }),

  setScanProgress: (progress) => set({ scanProgress: progress }),

  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

  setActive: (path) => set({ activePath: path }),

  toggleSelected: (path) => {
    const next = new Set(get().selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ selectedPaths: next })
  },

  selectAll: () => {
    const { viewEntries } = get()
    set({ selectedPaths: new Set(viewEntries.map((e) => e.path)) })
  },

  deselectAll: () => set({ selectedPaths: new Set() }),

  setSort: (field) => {
    const { sortBy, sortDir } = get()
    set({
      sortBy: field,
      sortDir: sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc',
    })
  },

  removePaths: (paths) => {
    const { viewEntries, selectedPaths, activePath } = get()
    const pathSet = new Set(paths)
    const filtered = viewEntries.filter((e) => !pathSet.has(e.path))
    const newSelected = new Set(selectedPaths)
    for (const p of pathSet) newSelected.delete(p)
    set({
      viewEntries: filtered,
      parentSize: filtered.reduce((sum, e) => sum + e.size, 0),
      selectedPaths: newSelected,
      activePath: activePath && pathSet.has(activePath) ? null : activePath,
    })
  },

  setError: (error) => set({ error, scanning: false }),

  showPermission: (show) => set({ showPermissionGuide: show }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleShortcuts: () => set({ showShortcuts: !get().showShortcuts }),

  reset: () => set(initialState),
}))
