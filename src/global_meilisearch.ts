import { appWindow } from "@tauri-apps/api/window"
import MeiliSearch, { DocumentOptions, Hit, SearchParams, SearchResponse } from "meilisearch"
import { SYNONYMS_MAP } from "./meilisearch_synonyms"
import { LRUCache } from "lru-cache"

export type Result = Hit<any>
export const maxTotalHits = 5000
type IndexName = "assets" | "anims"

// TODO: fix failed to search on app launching

type State = {
  addr?: string,
  indexingTaskIds: Set<number>,
  client?: MeiliSearch,
}

const state: State = {
  addr: undefined,
  indexingTaskIds: new Set(),
  client: undefined,
}

const queuedDocs: any[] = []

export const SEARCHABLE_FIELDS = ["id", "file", "tex", "fmodpath", "xml", "texpath", "plain_desc", "plain_alias", "search_text"]

export async function setAddr(addr: string) {
  if (state.addr === addr) return
  state.client = new MeiliSearch({host: addr})
  //@ts-ignore
  window.client = state.client

  const tasks = [
    await state.client.index("assets").deleteAllDocuments(),
    await state.client.index("anims").deleteAllDocuments(),

    await state.client.index("assets").updateSettings({
      filterableAttributes: ["type", "xml"],
      searchableAttributes: SEARCHABLE_FIELDS,
      separatorTokens: ["/"],
      synonyms: SYNONYMS_MAP,
      pagination: {
        maxTotalHits,
      }
    }),
    await state.client.index("anims").updateSettings({
      filterableAttributes: ["type", "bank"],
      searchableAttributes: ["name", "assetpath"],
      pagination: {
        maxTotalHits,
      }
    }),
  ]
  // ensure all init tasks are done
  let timer = setInterval(async()=> {
    let count = 0
    for (let task of tasks){
      const id = task.taskUid
      const response = await state.client.getTask(id)
      if (response.status === "succeeded"){
        count++
      }
    }
    if (count === tasks.length){
      console.log("Meilisearch: all init tasks done")
      clearInterval(timer)
      state.addr = addr
      flushDocuments()
    }
  }, 200)
}

export function getAddr(): string {
  return state.addr
}

export function isValid(): boolean {
  return state.addr !== undefined
}

export function isSearchable(): boolean {
  return state.addr !== undefined && state.indexingTaskIds.size === 0
}

function checkValid() {
  if (!isValid())
    throw Error("Meilisearch: client not valid")
}

setInterval(async ()=> {
  // check add indexing tasks
  if (state.indexingTaskIds.size === 0) return

  for (let id of state.indexingTaskIds) {
    const {status} = await state.client.getTask(id)
    if (status === "succeeded" || status === "failed"){
      console.log(`Meilisearch: TASK [${id}] ${status}`)
      state.indexingTaskIds.delete(id)
    }
  }
}, 200)

function checkTaskStatus(id: number) {
  state.indexingTaskIds.add(id)
}

export function addDocuments(index: IndexName, docs: any[], options?: DocumentOptions) {
  // check docs
  let invalidDoc = docs.find(v=> !v.id)
  if (invalidDoc){
    console.error("Find invalid doc: ", invalidDoc)
    window.alert("Find invalid doc\n" + JSON.stringify(invalidDoc))
  }
  if (!isValid()){
    let pos = docs.length === 0 ? -1 : queuedDocs.findIndex(v=> {
      if (v.index === index && v.docs.length === docs.length){
        if (JSON.stringify(v.docs.slice(0, 10)) === JSON.stringify(docs.slice(0, 10))){
          return true
        }
      }
      return false
    })
    if (pos === -1){
      queuedDocs.push({index, docs, options})
    }
    else {
      queuedDocs.splice(pos, 1, {index, docs, options})
    }
  }
  else {
    queuedDocs.push({index, docs, options})
    queuedDocs.forEach(({index, docs, options})=> {
      // console.log("Adding meiliseach documents: " + index + "(" + docs.length + ")")
      state.client.index(index)
        .updateDocuments(docs, options)
        .then(
          response=> {
            const id = response.taskUid
            console.log("Updated meiliseach documents: " + index + "(" + docs.length + ") - ID: " + id)
            checkTaskStatus(id)
          },
          error=> {
            console.error("Error in updating documents\n", error)
            appWindow.emit("runtime_error", error)
          }
        )
      })
    queuedDocs.splice(0, queuedDocs.length)
  }
}

export function flushDocuments() {
  if (isValid()) {
    addDocuments("anims", [])
  }
  else {
    console.error("Flush() must call after meilisearch client initialized")
  }
}

export type Response = SearchResponse<Record<string, any>, SearchParams>

export async function search(index: IndexName, query: string, options?: SearchParams) {
  checkValid()
  return await state.client.index(index).search(query, options)
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