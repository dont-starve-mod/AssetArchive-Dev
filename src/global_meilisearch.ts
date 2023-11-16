import { appWindow } from "@tauri-apps/api/window"
import MeiliSearch, { DocumentOptions, SearchParams } from "meilisearch"
import { SYNONYMS_MAP } from "./meilisearch_synonyms"

type State = {
  addr?: string,
  client?: MeiliSearch,
}

const state: State = {}
const queuedDocs: any[] = []

export function setAddr(addr: string) {
  state.addr = addr
  state.client = new MeiliSearch({host: addr})

  // state.client.createIndex("assets")
  state.client.index("assets").updateSettings({
    filterableAttributes: ["type"],
    searchableAttributes: ["file", "tex", "fmodpath", "xml", "texpath"],
    separatorTokens: ["/"],
    synonyms: SYNONYMS_MAP,
    pagination: {
      maxTotalHits: 5000,
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

type IndexName = "assets"

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
      state.client.index(index)
        .addDocuments(doc, options)
        .then(
          ()=> {},
          error=> {
            console.error("Error in adding documents\n", error)
            appWindow.emit("runtime_error", error)
          }
        )
    })
    queuedDocs.splice(0, queuedDocs.length)
  }
}

export async function search(index: IndexName, query: string, options?: SearchParams) {
  checkValid()
  let result = await state.client.index(index)
    .search(query, options)
  return result
}

//@ts-ignore
window.search = search
//@ts-ignore
window.client = ()=> state.client