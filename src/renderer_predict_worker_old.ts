import Searcher from "./asyncsearcher"
// import { PredictHelper } from "./renderer_predict"
function workerScript() {
/* start of script */

type EventType = "init" | "build" | "bank" | "animation"
// let PredictHelper = require("./renderer_predict")
let predict: PredictHelper | null = null

self.onmessage = (event: {data: {type: EventType, payload: any}}) => {
  const {type, payload}  = event.data
  if (type === "init") {
    predict = new PredictHelper(payload) // TODO: init by pre-generated index
  }
  else if (predict === null) {
    throw Error("PredictHelper is null")
  }
  // else if (type === "build" || type === "bank" || type == "animation" ){
  else if (type === "build") {
    const result = predict.predictBuild(payload as string)
    self.postMessage(result)
  }
  else if (type === "bank") {
    const result = predict.predictBank(payload as string)
    self.postMessage(result)
  }
  else if (type === "animation") {
    const result = predict.predictAnimation(payload.bank, payload.animation)
    self.postMessage(result)
  }
  else {
    throw Error("Invalid message type: " + type)
  }
}
/* end of script */
}

let script = workerScript.toString()
script = script.substring(script.indexOf("{") + 1, script.lastIndexOf("}"))
let blob = new Blob([script], {type: "application/javascript"})
let url = URL.createObjectURL(blob)

export const PREDICT = new Searcher(url)