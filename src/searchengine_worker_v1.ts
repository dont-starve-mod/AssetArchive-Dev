/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope

import { SearchEngine } from "./searchengine"

let searchengine: SearchEngine = null

export const init = (data: any) => {
  searchengine = new SearchEngine(data)
}

export const search = (query: string) => {
  const result = searchengine.search(query)
  return searchengine.deleteValue(result)
}