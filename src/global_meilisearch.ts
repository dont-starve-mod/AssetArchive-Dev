import { appWindow } from "@tauri-apps/api/window"
import MeiliSearch, { DocumentOptions, Hit, SearchParams, SearchResponse } from "meilisearch"
import { SYNONYMS_MAP } from "./meilisearch_synonyms"
import { LRUCache } from "lru-cache"

export type Result = Hit<any>
export const maxTotalHits = 5000

type State = {
  addr?: string,
  client?: MeiliSearch,
}

const state: State = {}
const queuedDocs: any[] = []

export function setAddr(addr: string) {
  state.addr = addr
  state.client = new MeiliSearch({host: addr})
  //@ts-ignore
  window.client = state.client

  // state.client.createIndex("assets")
  state.client.index("assets").updateSettings({
    filterableAttributes: ["type"],
    searchableAttributes: ["id", "file", "tex", "fmodpath", "xml", "texpath", "plain_desc", "plain_alias", "search_text", "animationList"],
    separatorTokens: ["/"],
    synonyms: SYNONYMS_MAP,
    pagination: {
      maxTotalHits,
    }
  })
}

export function getAddr(): string {
  return state.addr
}

export function isValid(): boolean {
  return state.addr !== undefined
}

function checkValid() {
  if (!isValid())
    throw Error("Meilisearch client not valided")
}

type IndexName = "assets" | "assets_update"

export function addDocuments(index: IndexName, doc: any[], options?: DocumentOptions) {
  if (!isValid()){
    let pos = queuedDocs.findIndex(v=> {
      if (v.index === index && v.doc.length === doc.length){
        if (JSON.stringify(v.doc.slice(0, 10)) === JSON.stringify(doc.slice(0, 10))){
          console.log("Find old", v)
          return true
        }
      }
    })
    if (pos !== -1){
      queuedDocs.push({index, doc, options})
    }
    else {
      queuedDocs.splice(pos, 1, {index, doc, options})
    }
  }
  else {
    queuedDocs.push({index, doc, options})
    queuedDocs.forEach(({index, doc, options})=> {
      if (index.endsWith("_update")){
        state.client.index(index.replace("_update", ""))
          .updateDocuments(doc, options)
          .catch(error=> {
            console.error("Error in updating documents\n", error)
            appWindow.emit("runtime_error", error)
          })
      }
      else{
        state.client.index(index)
          .updateDocuments(doc, options)
          .then(
            ()=> {},
            error=> {
              console.error("Error in adding documents\n", error)
              appWindow.emit("runtime_error", error)
            }
          )
      }
    })
    queuedDocs.splice(0, queuedDocs.length)
  }
}

export type Response = SearchResponse<Record<string, any>, SearchParams>

export async function search(index: IndexName, query: string, options?: SearchParams) {
  checkValid()

  let result = await state.client.index(index).search(query, options)
  return result
}

const cache = new LRUCache<string, Response>({max: 4})
export async function searchWithCache(index: IndexName, query: string, options?: SearchParams) {
  checkValid()
  // options param is `constant` now, so don't hash it :p
  // let cacheKey = `${index}@${query}<${JSON.stringify(options)}>`
  let cacheKey = `${index}@${query}`
  if (cache.has(cacheKey)){
    return cache.get(cacheKey)
  }
  let result = await state.client.index(index).search(query, options)
  cache.set(cacheKey, result)
  return result
}

//@ts-ignore
window.search = search