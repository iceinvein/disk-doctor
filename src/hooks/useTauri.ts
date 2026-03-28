import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppState } from '../state/context'
import type { DirEntry, ScanProgress, DiskUsage } from '../state/types'

export function useScan() {
  const { dispatch } = useAppState()

  useEffect(() => {
    const unlistenProgress = listen<ScanProgress>('scan-progress', (event) => {
      dispatch({ type: 'SET_SCAN_PROGRESS', progress: event.payload })
    })

    const unlistenDiscovered = listen<DirEntry[]>('scan-entries-discovered', (event) => {
      dispatch({ type: 'SET_DISCOVERED_ENTRIES', entries: event.payload })
    })

    const unlistenUpdated = listen<DirEntry>('scan-entry-updated', (event) => {
      dispatch({ type: 'UPDATE_SCANNED_ENTRY', entry: event.payload })
    })

    return () => {
      unlistenProgress.then((fn) => fn())
      unlistenDiscovered.then((fn) => fn())
      unlistenUpdated.then((fn) => fn())
    }
  }, [dispatch])

  const scanFolder = useCallback(async () => {
    try {
      const path = await invoke<string | null>('pick_folder')
      if (!path) return

      const name = path.split('/').filter(Boolean).pop() ?? path
      dispatch({ type: 'INIT_SCAN', rootPath: path, rootName: name })

      const start = performance.now()
      const tree = await invoke<DirEntry>('scan_directory', { path })
      const scanTime = (performance.now() - start) / 1000

      dispatch({ type: 'SET_TREE', tree, scanTime })
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [dispatch])

  const scanEntireDisk = useCallback(async () => {
    try {
      const hasAccess = await invoke<boolean>('check_full_disk_access')
      if (!hasAccess) {
        dispatch({ type: 'SHOW_PERMISSION_GUIDE', show: true })
        return
      }

      dispatch({ type: 'INIT_SCAN', rootPath: '/', rootName: 'Macintosh HD' })

      const start = performance.now()
      const tree = await invoke<DirEntry>('scan_directory', { path: '/' })
      const scanTime = (performance.now() - start) / 1000

      dispatch({ type: 'SET_TREE', tree, scanTime })
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [dispatch])

  const cancelScan = useCallback(async () => {
    try {
      await invoke('cancel_scan')
      dispatch({ type: 'SET_SCANNING', scanning: false })
    } catch {
      // Ignore cancel errors
    }
  }, [dispatch])

  return { scanFolder, scanEntireDisk, cancelScan }
}

export function useTrash() {
  const { dispatch } = useAppState()

  const trashItems = useCallback(
    async (paths: string[]): Promise<string[]> => {
      try {
        const failed = await invoke<string[]>('trash_items', { paths })
        const failedSet = new Set(failed)
        const succeeded = paths.filter((p) => !failedSet.has(p))

        if (succeeded.length > 0) {
          dispatch({ type: 'REMOVE_PATHS', paths: succeeded })
        }

        return failed
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          error: error instanceof Error ? error.message : String(error),
        })
        return paths
      }
    },
    [dispatch],
  )

  return { trashItems }
}

export async function openInFinder(path: string): Promise<void> {
  await invoke('open_in_finder', { path })
}

export async function checkFullDiskAccess(): Promise<boolean> {
  return invoke<boolean>('check_full_disk_access')
}

export async function openFullDiskAccessSettings(): Promise<void> {
  await invoke('open_full_disk_access_settings')
}

export async function getDiskUsage(path: string): Promise<DiskUsage> {
  return invoke<DiskUsage>('get_disk_usage', { path })
}
