import { useEffect, useReducer } from 'react'
import { AppContext } from './state/context'
import { appReducer, initialState } from './state/reducer'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Titlebar } from './components/Titlebar'
import { Toolbar } from './components/Toolbar'
import { DiskUsageBar } from './components/DiskUsageBar'
import { FileList } from './components/FileList'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'
import { ScanModal } from './components/ScanModal'
import { PermissionGuide } from './components/PermissionGuide'

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        if (state.currentPath.length > 0) {
          dispatch({ type: 'NAVIGATE_BACK' })
        }
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'DESELECT_ALL' })
        dispatch({ type: 'SET_ACTIVE', path: null })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.currentPath.length])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
        <Titlebar />
        {state.tree ? (
          <>
            <Toolbar />
            <DiskUsageBar />
            <div className="flex flex-1 min-h-0">
              <FileList />
              <DetailPanel />
            </div>
            <StatusBar />
          </>
        ) : state.showPermissionGuide ? (
          <PermissionGuide />
        ) : (
          <WelcomeScreen />
        )}
        {state.scanning && <ScanModal />}

        {/* Error toast */}
        {state.error && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[var(--color-bg-secondary)]
                          text-[var(--color-text-primary)] px-5 py-3 rounded-xl text-sm max-w-lg z-50
                          border border-[var(--color-danger)]/30 shadow-lg fade-in">
            <div className="flex items-center gap-3">
              <span className="text-[var(--color-danger)]">{state.error}</span>
              <button
                onClick={() => dispatch({ type: 'SET_ERROR', error: null })}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}
