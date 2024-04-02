import * as Comlink from "comlink"
import { v4 } from "uuid"

type WorkerFileName = "renderer_predict_worker" | "renderer_fuse_worker"
type ComlinkWorker = {
  core: Worker, 
  worker: Comlink.Remote<any>,
  state: "new" | "idle" | "working" | "terminated" | "error" ,
  isTerminated?: boolean,
}

export default class Searcher {
  url: WorkerFileName
  workers: {[K: string]: ComlinkWorker}
  timeout: number

  initPayload?: ()=> any

  constructor(url: WorkerFileName, timeout?: number) {
    this.url = url
    this.timeout = timeout || 10*1000
    this.workers = {}
  }

  newWorkerFromURL(url: WorkerFileName): Worker {
    switch (url){
      case "renderer_predict_worker":
        return new Worker(new URL("./renderer_predict_worker", import.meta.url), {type: "module"})
      case "renderer_fuse_worker":
        return new Worker(new URL("./renderer_fuse_worker", import.meta.url), {type: "module"})
      default:
        throw Error("Invalid url: " + url)
    }
  }

  newWorker(id: string): ComlinkWorker {
    let core: Worker = this.newWorkerFromURL(this.url)
    const worker: Comlink.Remote<any> = Comlink.wrap(core)
    this.workers[id] = { core, worker, state: "new" }
    if (typeof this.initPayload === "function") {
      this.workers[id].worker.init(this.initPayload()).then(
        ()=> this.workers[id].state = "idle",
        ()=> this.workers[id].state = "error"
      )
    }
    return this.workers[id]
  }

  getWorker(id?: string) {
    id = id || v4() // generate a new unique id
    const worker = this.workers[id]
    if (!worker) return this.newWorker(id)
    const {state} = worker
    if (state === "new" || state === "idle") {
      return worker
    }
    else if (state === "terminated" || state === "error") {
      return this.newWorker(id)
    }
    else if (state === "working"){
      // terminate old worker if id is same
      worker.core.terminate()
      worker.state = "terminated"
      return this.newWorker(id)
    }
    throw Error("Failed to get worker: unreachable")
  }

  get ready() {
    if (this.url === "renderer_fuse_worker")
      return true
  
    return this.initPayload !== undefined
  }

  search<T>(type: string, payload: any, id?: string): Promise<T[]> & { id: string } {
    id = id || v4()
    const result = new Promise<T[]>(async (resolve, reject)=> {
      if (!this.ready) return resolve([])
      let worker = this.getWorker(id)
      worker.state = "working"
      let timer = setTimeout(()=> {
        if (worker.state === "working") {
          console.log("Worker timeout, terminate.")
          worker.core.terminate()
          resolve([])
        }
      }, this.timeout)

      worker.worker.search(type, payload).then(
        (response: T[])=> { 
          clearTimeout(timer)
          resolve(response)
          worker.state = "idle"
        },
        (error: any)=> {
          reject(error)
          console.error(error)
          worker.state = "error"
        }
      )
    })
    // attach id to return promise, so that the worker can be terminated from outside.
    // @ts-ignore
    result.id = id
    // @ts-ignore
    return result
  }

  /** terminate search worker by id */
  terminate(id: string) {
    const worker = this.workers[id]
    if (worker) {
      worker.core.terminate()
      worker.state = "terminated"
      worker.isTerminated = true
    }
  }
}

export const predict = new Searcher("renderer_predict_worker")
export const fuseworker = new Searcher("renderer_fuse_worker")