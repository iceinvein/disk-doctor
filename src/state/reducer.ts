import type { AppState, Action } from './types'
import { getCurrentEntries, removePaths } from './helpers'

export const initialState: AppState = {
  tree: null,
  currentPath: [],
  selectedPaths: new Set(),
  activePath: null,
  sortBy: 'size',
  sortDir: 'desc',
  scanning: false,
  scanProgress: null,
  scanTime: null,
  error: null,
  showPermissionGuide: false,
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TREE':
      return {
        ...initialState,
        tree: action.tree,
        scanTime: action.scanTime,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
      }

    case 'SET_SCANNING':
      return {
        ...state,
        scanning: action.scanning,
        scanProgress: action.scanning ? state.scanProgress : null,
      }

    case 'SET_SCAN_PROGRESS':
      return {
        ...state,
        scanProgress: action.progress,
      }

    case 'INIT_SCAN':
      return {
        ...state,
        tree: {
          path: action.rootPath,
          name: action.rootName,
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
      }

    case 'ADD_SCANNED_ENTRY': {
      if (!state.tree) return state
      const newChildren = [...state.tree.children, action.entry]
      newChildren.sort((a, b) => b.size - a.size)
      const newSize = newChildren.reduce((sum, c) => sum + c.size, 0)
      return {
        ...state,
        tree: {
          ...state.tree,
          children: newChildren,
          child_count: newChildren.length,
          size: newSize,
        },
      }
    }

    case 'NAVIGATE_INTO':
      return {
        ...state,
        currentPath: [...state.currentPath, action.folderName],
        selectedPaths: new Set(),
        activePath: null,
      }

    case 'NAVIGATE_TO_BREADCRUMB':
      return {
        ...state,
        currentPath: state.currentPath.slice(0, action.index),
        selectedPaths: new Set(),
        activePath: null,
      }

    case 'NAVIGATE_BACK': {
      if (state.currentPath.length === 0) return state
      return {
        ...state,
        currentPath: state.currentPath.slice(0, -1),
        selectedPaths: new Set(),
        activePath: null,
      }
    }

    case 'SET_ACTIVE':
      return {
        ...state,
        activePath: action.path,
      }

    case 'TOGGLE_SELECTED': {
      const next = new Set(state.selectedPaths)
      if (next.has(action.path)) {
        next.delete(action.path)
      } else {
        next.add(action.path)
      }
      return {
        ...state,
        selectedPaths: next,
      }
    }

    case 'SELECT_ALL': {
      const entries = getCurrentEntries(state.tree, state.currentPath)
      const allPaths = new Set(entries.map((e) => e.path))
      return {
        ...state,
        selectedPaths: allPaths,
      }
    }

    case 'DESELECT_ALL':
      return {
        ...state,
        selectedPaths: new Set(),
      }

    case 'SET_SORT': {
      const sameField = state.sortBy === action.field
      return {
        ...state,
        sortBy: action.field,
        sortDir: sameField
          ? state.sortDir === 'asc'
            ? 'desc'
            : 'asc'
          : 'desc',
      }
    }

    case 'REMOVE_PATHS': {
      if (!state.tree) return state

      const newTree = removePaths(state.tree, action.paths)
      const removedSet = new Set(action.paths)

      const newSelected = new Set(state.selectedPaths)
      for (const p of removedSet) {
        newSelected.delete(p)
      }

      return {
        ...state,
        tree: newTree,
        selectedPaths: newSelected,
        activePath:
          state.activePath && removedSet.has(state.activePath)
            ? null
            : state.activePath,
      }
    }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        scanning: false,
      }

    case 'SHOW_PERMISSION_GUIDE':
      return {
        ...state,
        showPermissionGuide: action.show,
      }

    case 'RESET':
      return initialState

    default:
      return state
  }
}
