/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope

import { PredictHelper, PredictableData } from "./renderer_predict"

let predict: PredictHelper | null = null

export const init = (data: PredictableData)=> {
  predict = new PredictHelper(data)
}

export const search = (
  type: "build" | "bank" | "animation", 
  value: string | {bank: "string", animation: "string"})=> {
  
  if (predict === null)
    return []

  switch (type) {
    case "build":
      return predict.predictBuild(value as string)
    case "bank":
      return predict.predictBank(value as string)
    case "animation":
      const {bank, animation} = value as any
      return predict.predictAnimation(bank, animation)
  }
}

export const test = () => "Worker works!"

const sleep = (time: number)=> new Promise(
  (resolve)=> setTimeout(resolve, time))

export const timeout = async ()=> {
  console.log("timeout")
  await sleep(2000)
  console.log("tick1")
  await sleep(2000)
  console.log("tick2")
}