import { useReducer } from 'react'
import { AppContext } from './state/context'
import { appReducer, initialState } from './state/reducer'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Titlebar } from './components/Titlebar'
import { ScanModal } from './components/ScanModal'

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
        <Titlebar />
        {state.tree ? (
          <div className="flex-1 text-[var(--color-text-secondary)] flex items-center justify-center">
            <p>Scan complete — {state.tree.name}</p>
          </div>
        ) : (
          <WelcomeScreen />
        )}
        {state.scanning && <ScanModal />}
      </div>
    </AppContext.Provider>
  )
}
