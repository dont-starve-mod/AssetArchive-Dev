import { useCallback, useContext, useEffect, useState } from "react"
import animstateContext from "../../pages/AnimRendererPage/globalanimstate"
import { predict } from "../../asyncsearcher"
import { FuseResult } from "../../searchengine"

/** get global animstate instance, this hook can only use in animrenderer subwindow */
export function useGlobalAnimState() {
  return useContext(animstateContext).animstate
}

export function useBasicPredicter(
  field: "bank" | "build" | "animation", 
  payload: string | object, 
  matchPredicate?: (match: any, query: any)=> boolean) {

  const [result, setResult] = useState(undefined)
  useEffect(()=> {
    let skip = false
    console.log("?", field, payload)
    predict.search(field, payload, false).then(
      result=> {
        if (skip) return
        setResult(result)
      }
    )
    return ()=> { skip = true }
  }, [payload])

  const hasPredicted = result !== undefined
  const bestMatch = result && result.length && result[0].matches[0].value
  const isvalid = matchPredicate === undefined ? bestMatch === payload : matchPredicate(bestMatch, payload)

  return {
    result,
    hasPredicted,
    bestMatch,
    isvalid,
  }
}

export function usePredicterFormatter(type: "default") {
  return useCallback(({bestMatch})=> {
    switch (type) {
      case "default":
        return typeof bestMatch === "string" ?
          `参数无效，你是否指的是“${bestMatch}”？` :
          `参数无效`
    }
  }, [type])
}