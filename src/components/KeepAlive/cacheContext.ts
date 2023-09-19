import { createContext } from "react"

type CacheContext = {
  cacheStates: any,
  setScrollableWidget: (node: {node: HTMLElement})=> void,
  mount: Function,
  cache: Function,
  drop: Function,
  addRecord: Function,
}

let cacheContext = createContext<CacheContext>(null)
export default cacheContext