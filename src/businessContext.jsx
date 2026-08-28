import { createContext, useContext } from "react"

export const BusinessContext = createContext(null)

export function useBusiness() {
  return useContext(BusinessContext)
}