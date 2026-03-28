import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from './state/store'
import { useScanEvents, useNavigation } from './hooks/useTauri'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Titlebar } from './components/Titlebar'
import { Toolbar } from './components/Toolbar'
import { DiskUsageBar } from './components/DiskUsageBar'
import { FileList } from './components/FileList'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'
import { PermissionGuide } from './components/PermissionGuide'
import { ShortcutOverlay } from './components/ShortcutOverlay'

export default function App() {
  const rootPath = useStore(s => s.rootPath)
  const showPermissionGuide = useStore(s => s.showPermissionGuide)
  const error = useStore(s => s.error)
  const deselectAll = useStore(s => s.deselectAll)
  const setActive = useStore(s => s.setActive)
  const setError = useStore(s => s.setError)
  const toggleShortcuts = useStore(s => s.toggleShortcuts)
  const { navigateBack } = useNavigation()

  // Global event listeners — always mounted, survive component swaps
  useScanEvents()

  // Keyboard navigation and shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input field
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !isInput)) {
        if (useStore.getState().breadcrumbs.length > 1) {
          navigateBack()
        }
      }
      if (e.key === 'Escape') {
        deselectAll()
        setActive(null)
      }

      // Cmd+A: select all
      if (e.metaKey && e.key === 'a' && !isInput) {
        e.preventDefault()
        useStore.getState().selectAll()
      }

      // Cmd+Backspace: trash selected
      if (e.metaKey && e.key === 'Backspace') {
        const { selectedPaths } = useStore.getState()
        if (selectedPaths.size > 0) {
          e.preventDefault()
          // Click the trash button in the StatusBar to trigger its confirmation dialog
          const trashBtn = document.querySelector('[data-batch-trash]') as HTMLButtonElement | null
          trashBtn?.click()
        }
      }

      // Cmd+F: focus search input
      if (e.metaKey && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.getElementById('search-filter-input') as HTMLInputElement | null
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }

      // ?: toggle keyboard shortcut overlay (only when not typing in an input)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey) {
        toggleShortcuts()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateBack, deselectAll, setActive, toggleShortcuts])

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      <Titlebar />
      {rootPath ? (
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

      <ShortcutOverlay />

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
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
