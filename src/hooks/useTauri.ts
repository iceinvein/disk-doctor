import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../state/store'
import type { DirEntry, ScanProgress, DiskUsage } from '../state/types'

/**
 * Set up Tauri event listeners for scan streaming.
 * Call this ONCE at the App level so listeners survive component swaps.
 */
export function useScanEvents() {
  useEffect(() => {
    // Throttle tree updates to animation frames to prevent React jank.
    // Multiple scan-tree-update events between frames → only the latest is applied.
    let pendingTree: DirEntry | null = null
    let rafId: number | null = null

    function flushTree() {
      if (pendingTree) {
        useStore.getState().updateTree(pendingTree)
        pendingTree = null
      }
      rafId = null
    }

    const unlistenProgress = listen<ScanProgress>('scan-progress', (event) => {
      useStore.getState().setScanProgress(event.payload)
    })

    const unlistenTree = listen<DirEntry>('scan-tree-update', (event) => {
      pendingTree = event.payload
      if (rafId === null) {
        rafId = requestAnimationFrame(flushTree)
      }
    })

    return () => {
      unlistenProgress.then((fn) => fn())
      unlistenTree.then((fn) => fn())
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])
}

export function useScan() {
  const initScan = useStore(s => s.initScan)
  const setTree = useStore(s => s.setTree)
  const setError = useStore(s => s.setError)
  const setScanning = useStore(s => s.setScanning)
  const showPermission = useStore(s => s.showPermission)

  const scanFolder = useCallback(async () => {
    try {
      const path = await invoke<string | null>('pick_folder')
      if (!path) return

      const name = path.split('/').filter(Boolean).pop() ?? path
      initScan(path, name)

      const start = performance.now()
      const tree = await invoke<DirEntry>('scan_directory', { path })
      const scanTime = (performance.now() - start) / 1000

      setTree(tree, scanTime)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [initScan, setTree, setError])

  const scanEntireDisk = useCallback(async () => {
    try {
      const hasAccess = await invoke<boolean>('check_full_disk_access')
      if (!hasAccess) {
        showPermission(true)
        return
      }

      initScan('/', 'Macintosh HD')

      const start = performance.now()
      const tree = await invoke<DirEntry>('scan_directory', { path: '/' })
      const scanTime = (performance.now() - start) / 1000

      setTree(tree, scanTime)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [initScan, setTree, setError, showPermission])

  const cancelScan = useCallback(async () => {
    try {
      await invoke('cancel_scan')
      setScanning(false)
    } catch {
      // Ignore cancel errors
    }
  }, [setScanning])

  return { scanFolder, scanEntireDisk, cancelScan }
}

export function useTrash() {
  const removePaths = useStore(s => s.removePaths)
  const setError = useStore(s => s.setError)

  const trashItems = useCallback(
    async (paths: string[]): Promise<string[]> => {
      try {
        const failed = await invoke<string[]>('trash_items', { paths })
        const failedSet = new Set(failed)
        const succeeded = paths.filter((p) => !failedSet.has(p))

        if (succeeded.length > 0) {
          removePaths(succeeded)
        }

        return failed
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error))
        return paths
      }
    },
    [removePaths, setError],
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
