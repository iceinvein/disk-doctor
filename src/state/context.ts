import { createContext, useContext } from 'react'
import type { AppState, Action } from './types'
import { initialState } from './reducer'

type AppContextValue = {
  state: AppState
  dispatch: React.Dispatch<Action>
}

export const AppContext = createContext<AppContextValue>({
  state: initialState,
  dispatch: () => {},
})

export function useAppState() {
  return useContext(AppContext)
}
