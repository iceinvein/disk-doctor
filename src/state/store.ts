import { create } from 'zustand'
import type { DirEntry, ScanProgress, SortField } from './types'
import { getCurrentEntries, removePaths } from './helpers'

type AppStore = {
  // State
  tree: DirEntry | null
  currentPath: string[]
  selectedPaths: Set<string>
  activePath: string | null
  sortBy: SortField
  sortDir: 'asc' | 'desc'
  scanning: boolean
  scanProgress: ScanProgress | null
  scanTime: number | null
  error: string | null
  showPermissionGuide: boolean

  // Actions
  setTree: (tree: DirEntry, scanTime: number) => void
  setScanning: (scanning: boolean) => void
  setScanProgress: (progress: ScanProgress) => void
  initScan: (rootPath: string, rootName: string) => void
  setDiscoveredEntries: (entries: DirEntry[]) => void
  updateScannedEntry: (entry: DirEntry) => void
  navigateInto: (folderName: string) => void
  navigateToBreadcrumb: (index: number) => void
  navigateBack: () => void
  setActive: (path: string | null) => void
  toggleSelected: (path: string) => void
  selectAll: () => void
  deselectAll: () => void
  setSort: (field: SortField) => void
  removePaths: (paths: string[]) => void
  setError: (error: string | null) => void
  showPermission: (show: boolean) => void
  reset: () => void
}

const initialState = {
  tree: null as DirEntry | null,
  currentPath: [] as string[],
  selectedPaths: new Set<string>(),
  activePath: null as string | null,
  sortBy: 'size' as SortField,
  sortDir: 'desc' as 'asc' | 'desc',
  scanning: false,
  scanProgress: null as ScanProgress | null,
  scanTime: null as number | null,
  error: null as string | null,
  showPermissionGuide: false,
}

export const useStore = create<AppStore>((set, get) => ({
  ...initialState,

  setTree: (tree, scanTime) =>
    set({
      tree,
      scanTime,
      scanning: false,
      scanProgress: null,
      currentPath: [],
      selectedPaths: new Set(),
      activePath: null,
      error: null,
      showPermissionGuide: false,
      sortBy: get().sortBy,
      sortDir: get().sortDir,
    }),

  setScanning: (scanning) =>
    set({ scanning, scanProgress: scanning ? get().scanProgress : null }),

  setScanProgress: (progress) => set({ scanProgress: progress }),

  initScan: (rootPath, rootName) =>
    set({
      tree: {
        path: rootPath,
        name: rootName,
        size: 0,
        is_dir: true,
        child_count: 0,
        modified: 0,
        is_symlink: false,
        is_restricted: false,
        children: [],
      },
      scanning: true,
      scanProgress: null,
      scanTime: null,
      currentPath: [],
      selectedPaths: new Set(),
      activePath: null,
      error: null,
      showPermissionGuide: false,
    }),

  setDiscoveredEntries: (entries) => {
    const tree = get().tree
    if (!tree) return
    const totalSize = entries.reduce((sum, c) => sum + c.size, 0)
    set({
      tree: { ...tree, children: entries, child_count: entries.length, size: totalSize },
    })
  },

  updateScannedEntry: (entry) => {
    const tree = get().tree
    if (!tree) return
    const updated = tree.children.map((child) =>
      child.path === entry.path ? entry : child,
    )
    updated.sort((a, b) => b.size - a.size)
    const newSize = updated.reduce((sum, c) => sum + c.size, 0)
    set({
      tree: { ...tree, children: updated, child_count: updated.length, size: newSize },
    })
  },

  navigateInto: (folderName) =>
    set((s) => ({
      currentPath: [...s.currentPath, folderName],
      selectedPaths: new Set(),
      activePath: null,
    })),

  navigateToBreadcrumb: (index) =>
    set((s) => ({
      currentPath: s.currentPath.slice(0, index),
      selectedPaths: new Set(),
      activePath: null,
    })),

  navigateBack: () => {
    const { currentPath } = get()
    if (currentPath.length === 0) return
    set({
      currentPath: currentPath.slice(0, -1),
      selectedPaths: new Set(),
      activePath: null,
    })
  },

  setActive: (path) => set({ activePath: path }),

  toggleSelected: (path) => {
    const next = new Set(get().selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ selectedPaths: next })
  },

  selectAll: () => {
    const { tree, currentPath } = get()
    const entries = getCurrentEntries(tree, currentPath)
    set({ selectedPaths: new Set(entries.map((e) => e.path)) })
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
    const { tree, selectedPaths, activePath } = get()
    if (!tree) return
    const newTree = removePaths(tree, paths)
    const pathSet = new Set(paths)
    const newSelected = new Set(selectedPaths)
    for (const p of pathSet) newSelected.delete(p)
    set({
      tree: newTree,
      selectedPaths: newSelected,
      activePath: activePath && pathSet.has(activePath) ? null : activePath,
    })
  },

  setError: (error) => set({ error, scanning: false }),

  showPermission: (show) => set({ showPermissionGuide: show }),

  reset: () => set(initialState),
}))
