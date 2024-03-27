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
  client?: MeiliSearch,
}

const state: State = {}
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
      console.log("All init tasks done")
      clearInterval(timer)
      state.addr = addr
    }
  }, 200)
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

function checkTaskStatus(id: number) {
  let timer = 0
  timer = setInterval(()=> {
    state.client.getTask(id)
      .then(
        response=> {
          switch (response.status) {
            case "enqueued": return
            case "processing": return
            case "succeeded": {
              console.log("Task succeeded: ", id, response.details)
              return clearInterval(timer)
            }
            case "failed": {
              console.error("Task failed: ", response)
              return clearInterval(timer)
            }
            default: 
              console.log(response)
          }
        },
        error=> {
          console.error("Error in get task status\n", error)
        }
      )
    }, 200) as any
}

export function addDocuments(index: IndexName, docs: any[], options?: DocumentOptions) {
  // check docs
  let invalidDoc = docs.find(v=> !v.id)
  if (invalidDoc){
    console.error("Find invalid doc: ", invalidDoc)
    window.alert("Find invalid doc\n" + JSON.stringify(invalidDoc))
  }
  if (!isValid()){
    let pos = queuedDocs.findIndex(v=> {
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
      console.log("Adding meiliseach documents: " + index + "(" + docs.length + ")")
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