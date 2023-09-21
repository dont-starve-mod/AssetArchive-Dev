import * as Comlink from "comlink"

type WorkerFileName = "renderer_predict_worker" | "searchengine_worker"
type ComlinkWorker = {
  core: Worker, 
  worker: Comlink.Remote<any>,
  state: "new" | "idle" | "working" | "terminated" | "error" ,
  isTerminated?: boolean,
}

export default class Searcher {
  url: WorkerFileName
  worker: ComlinkWorker
  timeout: number

  initPayload?: ()=> any

  constructor(url: WorkerFileName, timeout?: number) {
    this.url = url
    this.timeout = timeout || 10*1000
    this.newWorker()
  }

  newWorker(): ComlinkWorker {
    if (this.url === "renderer_predict_worker"){
      const core = new Worker(new URL("./renderer_predict_worker", import.meta.url), {type: "module"})
      const worker = Comlink.wrap(core)
      this.worker = { core, worker, state: "new" }
    }
    else if (this.url === "searchengine_worker"){
      const core = new Worker(new URL("./searchengine_worker", import.meta.url), {type: "module"})
      const worker = Comlink.wrap(core)
      this.worker = { core, worker, state: "new" }
    }
    else {
      throw Error("Invalid url: " + this.url)
    }
    this.worker.worker.init(this.initPayload?.()).then(
      ()=> this.worker.state = "idle",
      ()=> this.worker.state = "error"
    )
    return this.worker
  }

  getWorker(uniqueWorker: boolean) {
    const { state } = this.worker
    if (state === "new" || state == "idle") {
      return this.worker
    }
    else if (state === "terminated" || state === "error") {
      return this.newWorker()
    }
    else if (uniqueWorker === false) {
      return this.newWorker()
    }
    else if (state === "working") {
      this.worker.core.terminate()
      this.worker.state = "terminated"
      return this.newWorker()
    }
  }

  get ready() {
    return this.initPayload !== undefined
  }

  async search(type: string, payload: any, uniqueWorker?: false): Promise<any[]> {
    return new Promise(async (resolve, reject)=> {
      if (!this.ready) return resolve([])
      let worker = this.getWorker(uniqueWorker)
      worker.state = "working"
      let timer = setTimeout(()=> {
        if (worker.state === "working") {
          console.log("Worker timeout, terminate.")
          worker.core.terminate()
          resolve([])
        }
      }, this.timeout)

      worker.worker.search(type, payload).then(
        response=> { 
          clearTimeout(timer)
          resolve(response)
          worker.state = "idle"
        },
        error=> {
          reject(error)
          console.error(error)
          worker.state = "error"
        }
      )
    })
  }
}

export const predict = new Searcher("renderer_predict_worker")
export const searchengine = new Searcher("searchengine_worker")