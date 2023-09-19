import * as Comlink from "comlink"

interface WorkerExt {
  isTerminated?: boolean,
  init?: (data: any)=> void,
  search?: any,
}

type WorkerFileName = "renderer_predict_worker"

export default class Searcher {
  url: WorkerFileName
  worker: Worker & WorkerExt
  state: "init" | "idle" | "working" | "terminated" | "error" 
  timeout: number

  initPayload?: ()=> any

  constructor(url: WorkerFileName, timeout?: number) {
    this.url = url
    this.state = "init"
    this.timeout = timeout || 10*1000 // do not work actually...
  }

  newWorker(): Worker & WorkerExt {
    if (this.url === "renderer_predict_worker"){
      // const worker = new Worker(new URL("./renderer_predict_worker", import.meta.url), {type: "module"})
      // this.worker = Comlink.wrap(worker)
      this.worker = new ComlinkWorker(new URL("./renderer_predict_worker", import.meta.url)) as any
    }
    else {
      throw Error("Invalid url: " + this.url)
    }
    this.worker.init(this.initPayload())
    return this.worker
  }

  getWorker() {
    return this.worker || this.newWorker()
    // TODO: fix this
    if (this.state === "idle") {
      return this.worker
    }
    else if (this.state === "init" || this.state === "terminated") {
      return this.newWorker()
    }
    else if (this.state === "working" || this.state === "error") {
      this.termiate()
      return this.newWorker()
    }
  }

  get ready() {
    return this.initPayload !== undefined
  }

  async search(type: string, payload: any): Promise<any[]> {
    return new Promise(async (resolve, reject)=> {
      if (!this.ready) return resolve([])
      let worker = this.getWorker()
      this.state = "working"
      setTimeout(()=> {
        if (this.state === "working" && this.worker === worker) {
          console.log("Worker timeout, terminate.")
          this.termiate()
          resolve([])
        }
      }, this.timeout)

      worker.search(type, payload).then(
        response=> { 
          resolve(response)
          this.state = "idle"
        },
        error=> {
          reject(error)
          console.error(error)
          this.state = "error"
        }
      )
    })
  }

  termiate() {
    // TODO: it's hard to impl when using Comlink & Vite, do it if needed later
    if (this.worker) {
      console.log("Terminate", this.worker)
    }
  }
}

export const predict = new Searcher("renderer_predict_worker")