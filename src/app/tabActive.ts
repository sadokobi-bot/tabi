import { createContext, useContext } from 'react'

/** Whether the tab containing the current component is the visible one (screens stay mounted). */
export const TabActiveContext = createContext(true)

export const useTabActive = () => useContext(TabActiveContext)
