import { useEffect } from 'react'
import { useStore } from './state/store'
import { useScanEvents } from './hooks/useTauri'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Titlebar } from './components/Titlebar'
import { Toolbar } from './components/Toolbar'
import { DiskUsageBar } from './components/DiskUsageBar'
import { FileList } from './components/FileList'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'
import { PermissionGuide } from './components/PermissionGuide'

export default function App() {
  const tree = useStore(s => s.tree)
  const showPermissionGuide = useStore(s => s.showPermissionGuide)
  const error = useStore(s => s.error)
  const navigateBack = useStore(s => s.navigateBack)
  const deselectAll = useStore(s => s.deselectAll)
  const setActive = useStore(s => s.setActive)
  const setError = useStore(s => s.setError)

  // Global event listeners — always mounted, survive component swaps
  useScanEvents()

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        if (useStore.getState().currentPath.length > 0) {
          navigateBack()
        }
      }
      if (e.key === 'Escape') {
        deselectAll()
        setActive(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateBack, deselectAll, setActive])

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      <Titlebar />
      {tree ? (
        <>
          <Toolbar />
          <DiskUsageBar />
          <div className="flex flex-1 min-h-0">
            <FileList />
            <DetailPanel />
          </div>
          <StatusBar />
        </>
      ) : showPermissionGuide ? (
        <PermissionGuide />
      ) : (
        <WelcomeScreen />
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[var(--color-bg-secondary)]
                        text-[var(--color-text-primary)] px-5 py-3 rounded-xl text-sm max-w-lg z-50
                        border border-[var(--color-danger)]/30 shadow-lg fade-in">
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-danger)]">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
