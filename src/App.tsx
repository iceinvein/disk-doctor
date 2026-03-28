import { useEffect, useReducer } from 'react'
import { AppContext } from './state/context'
import { appReducer, initialState } from './state/reducer'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Titlebar } from './components/Titlebar'
import { Toolbar } from './components/Toolbar'
import { FileList } from './components/FileList'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'
import { ScanModal } from './components/ScanModal'

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
            <div className="flex flex-1 min-h-0">
              <FileList />
              <DetailPanel />
            </div>
            <StatusBar />
          </>
        ) : (
          <WelcomeScreen />
        )}
        {state.scanning && <ScanModal />}

        {/* Error toast */}
        {state.error && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-red-900/90
                          text-white px-6 py-3 rounded-lg text-sm max-w-lg z-50
                          border border-red-700">
            <div className="flex items-center gap-3">
              <span>{state.error}</span>
              <button
                onClick={() => dispatch({ type: 'SET_ERROR', error: null })}
                className="text-red-300 hover:text-white cursor-pointer"
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
