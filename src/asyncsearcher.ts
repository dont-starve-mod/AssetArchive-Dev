interface WorkerExt {
  isTerminated?: boolean
}

export default class Searcher {
  url: string
  worker: Worker & WorkerExt
  state: "init" | "idle" | "working" | "terminated" | "error" 
  timeout: number
  intervalTimer: any

  initPayload?: ()=> any

  constructor(url: string, timeout?: number) {
    this.url = url
    this.state = "init"
    this.timeout = timeout || 10*1000
    this.intervalTimer = -1
  }

  getWorker(): Worker & WorkerExt {
    if (this.state === "idle") {
      return this.worker
    }
    else if (this.state === "init" || this.state === "terminated") {
      this.worker = new Worker(this.url, {type: "module"})
      this.worker.postMessage({type: "init", payload: this.initPayload()})
      return this.worker
    }
    else if (this.state === "working" || this.state === "error") {
      this.termiate()
      this.worker = new Worker(this.url, {type: "module"})
      this.worker.postMessage({type: "init", payload: this.initPayload()})
      return this.worker
    }
  }

  get ready() {
    return this.initPayload !== undefined
  }

  async search(type: string, payload: any): Promise<any[]> {
    return new Promise((resolve, reject)=> {
      if (!this.ready) return resolve([])

      let timer = 0
      let loops = this.timeout / 100
      let worker = this.getWorker()
      this.state = "working"
      worker.onerror = (e)=> {
        clearInterval(timer)
        console.error("Worker error:\n", e)
        this.state = "error"
        reject("Worker error")
      }
      worker.onmessage = (e)=> {
        clearInterval(timer)
        console.log("MESSAGE", type, payload, e)
        this.state = "idle"
        resolve(e)
      }
      worker.postMessage({type, payload})

      timer = Number(setInterval(()=> {
        if (worker.isTerminated) {
          clearInterval(timer)
          reject("Terminated")
        }
        loops -= 1
        if (loops <= 0){
          clearInterval(timer)
          reject("Timeout")
        }
      }, 100))
    })
  }

  termiate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker.isTerminated = true
    }
  }
}