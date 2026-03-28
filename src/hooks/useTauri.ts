import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppState } from '../state/context'
import type { DirEntry, ScanProgress, DiskUsage } from '../state/types'

export function useScan() {
  const { dispatch } = useAppState()

  useEffect(() => {
    const unlisten = listen<ScanProgress>('scan-progress', (event) => {
      dispatch({ type: 'SET_SCAN_PROGRESS', progress: event.payload })
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [dispatch])

  const scanFolder = useCallback(async () => {
    try {
      const path = await invoke<string | null>('pick_folder')
      if (!path) return

      dispatch({ type: 'SET_SCANNING', scanning: true })

      const start = performance.now()
      const tree = await invoke<DirEntry>('scan_directory', { path })
      const scanTime = Math.round(performance.now() - start)

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
        dispatch({
          type: 'SET_ERROR',
          error:
            'Full Disk Access is required. Go to System Settings > Privacy & Security > Full Disk Access and enable it for Disk Doctor, then restart the app.',
        })
        return
      }

      dispatch({ type: 'SET_SCANNING', scanning: true })

      const start = performance.now()
      const tree = await invoke<DirEntry>('scan_directory', { path: '/' })
      const scanTime = Math.round(performance.now() - start)

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

export async function getDiskUsage(path: string): Promise<DiskUsage> {
  return invoke<DiskUsage>('get_disk_usage', { path })
}
