import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../state/store'
import type { DirEntry, ScanProgress, DiskUsage, ViewUpdate, BreadcrumbSegment } from '../state/types'

/**
 * Set up Tauri event listeners for scan streaming.
 * Call this ONCE at the App level so listeners survive component swaps.
 */
export function useScanEvents() {
  useEffect(() => {
    // Throttle view updates to animation frames to prevent React jank.
    let pendingUpdate: ViewUpdate | null = null
    let rafId: number | null = null

    function flushUpdate() {
      if (pendingUpdate) {
        console.log(`[scan] RAF flush → applying view-update to store`)
        useStore.getState().setViewUpdate(pendingUpdate)
        pendingUpdate = null
      }
      rafId = null
    }

    const unlistenProgress = listen<ScanProgress>('scan-progress', (event) => {
      useStore.getState().setScanProgress(event.payload)
    })

    let viewUpdateCount = 0

    const unlistenViewUpdate = listen<ViewUpdate>('view-update', (event) => {
      viewUpdateCount++
      const update = event.payload
      console.log(
        `[scan] view-update #${viewUpdateCount}: ${update.entries.length} entries at '${update.parent_name}', parent_size=${update.parent_size}, total_scanned=${update.total_scanned}`,
      )
      pendingUpdate = update
      if (rafId === null) {
        rafId = requestAnimationFrame(flushUpdate)
      }
    })

    return () => {
      unlistenProgress.then((fn) => fn())
      unlistenViewUpdate.then((fn) => fn())
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])
}

export function useScan() {
  const initScan = useStore(s => s.initScan)
  const setScanComplete = useStore(s => s.setScanComplete)
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
      await invoke<DirEntry>('scan_directory', { path })
      const scanTime = (performance.now() - start) / 1000

      console.log(`[scan] complete in ${scanTime.toFixed(1)}s`)
      setScanComplete(scanTime)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [initScan, setScanComplete, setError])

  const scanEntireDisk = useCallback(async () => {
    try {
      const hasAccess = await invoke<boolean>('check_full_disk_access')
      if (!hasAccess) {
        showPermission(true)
        return
      }

      initScan('/', 'Macintosh HD')

      const start = performance.now()
      await invoke<DirEntry>('scan_directory', { path: '/' })
      const scanTime = (performance.now() - start) / 1000

      console.log(`[scan] complete in ${scanTime.toFixed(1)}s`)
      setScanComplete(scanTime)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [initScan, setScanComplete, setError, showPermission])

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

/**
 * Navigation functions that coordinate store state + Rust IPC.
 */
export function useNavigation() {
  const setViewEntries = useStore(s => s.setViewEntries)
  const setBreadcrumbs = useStore(s => s.setBreadcrumbs)

  const navigateTo = useCallback(
    async (path: string, breadcrumbs: BreadcrumbSegment[]) => {
      console.log(`[nav] navigateTo: ${path}`)
      await invoke('set_view_path', { path })
      const result = await invoke<ViewUpdate>('get_children', { path })
      console.log(
        `[nav] got ${result.entries.length} children, parent_size=${result.parent_size}`,
      )
      setBreadcrumbs(breadcrumbs)
      setViewEntries(result.entries, result.parent_size)
    },
    [setViewEntries, setBreadcrumbs],
  )

  const navigateInto = useCallback(
    async (entry: DirEntry) => {
      const currentBreadcrumbs = useStore.getState().breadcrumbs
      const newBreadcrumbs = [...currentBreadcrumbs, { name: entry.name, path: entry.path }]
      await navigateTo(entry.path, newBreadcrumbs)
    },
    [navigateTo],
  )

  const navigateBack = useCallback(async () => {
    const { breadcrumbs } = useStore.getState()
    if (breadcrumbs.length <= 1) return
    const newBreadcrumbs = breadcrumbs.slice(0, -1)
    const target = newBreadcrumbs[newBreadcrumbs.length - 1]
    await navigateTo(target.path, newBreadcrumbs)
  }, [navigateTo])

  const navigateToBreadcrumb = useCallback(
    async (index: number) => {
      const { breadcrumbs } = useStore.getState()
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1)
      const target = newBreadcrumbs[newBreadcrumbs.length - 1]
      await navigateTo(target.path, newBreadcrumbs)
    },
    [navigateTo],
  )

  return { navigateInto, navigateBack, navigateToBreadcrumb }
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
