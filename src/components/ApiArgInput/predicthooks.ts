import { useCallback, useContext, useEffect, useState } from "react"
import animstateContext from "../../pages/AnimRendererPage/globalanimstate"
import { predict, fuseworker } from "../../asyncsearcher"
import { useSelector } from "../../redux/store"

/** get global animstate instance, this hook can only use in animrenderer subwindow */
export function useGlobalAnimState() {
  return useContext(animstateContext).animstate
}

export function useBasicPredicter(
  field: "bank" | "build" | "animation", 
  payload: string | object, 
  matchPredicate?: (match: any, query: any)=> boolean) {

  const [result, setResult] = useState(undefined)
  const predict_ready = useSelector(({appstates})=> appstates.predict_init_flag)
  useEffect(()=> {
    if (!predict_ready) return
    console.log(field, payload)
    let unmountFlag = false
    let session = predict.search(field, payload)
    session.then(
      result=> !unmountFlag && setResult(result)
    )
    return ()=> { 
      predict.terminate(session.id)
      unmountFlag = true 
    }
  }, [payload, predict_ready, field])

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

export function useHashPredicter(
  query: string,
  items: (string | number)[]) {

  const [result, setResult] = useState(undefined)
  const predict_ready = useSelector(({appstates})=> appstates.predict_init_flag)
  useEffect(()=> {
    if (!predict_ready) return
    let unmountFlag = false
    let session = fuseworker.search(query, {items, options: {isCaseSensitive: false}})
    session.then(
      result=> {
        if (unmountFlag) return
        setResult(result)
      }
    )
    return ()=> { 
      unmountFlag = true
      fuseworker.terminate(session.id)
    }
  }, [query, items, predict_ready])

  const hasPredicted = result !== undefined
  const bestMatch = result && result.length && result[0].matches[0].value
  const isvalid = typeof bestMatch === "string" && bestMatch.toLowerCase() === query.toLowerCase()

  return {
    result,
    hasPredicted,
    bestMatch,
    isvalid,
  }
}

export function usePredicterFormatter(type: "default" | "symbol") {
  return useCallback(({value, bestMatch})=> {
    switch (type) {
      case "default":
        return typeof bestMatch === "string" ?
          `参数无效，你是否指的是“${bestMatch}”？` :
          `参数无效`
      case "symbol":
        return `当前动画中不存在“${value}”，因此指令不会生效。` + 
          (typeof bestMatch === "string" ?  `\n你是否指的是“${bestMatch}”？` : "" )
    }
  }, [type])
}

export function useValidFlags(numParams?: number):
  [boolean, (valid: boolean, index: number)=> void] {
  const [flags, setFlags] = useState([true, true, true, true, true, true, true, true, true, true])
  const setFlagOnIndex = useCallback((valid: boolean, index: number)=> {
    if (index >= 0 && index < numParams) {
      setFlags(v=> {
        let result = Array.from(v) // clone
        result[index] = valid
        return result
      })
    }
    else {
      console.warn("useValidFlags: invalid index: ", index)
    }
  }, [numParams])
  const valid = flags.find(v=> v === false) === undefined
  return [valid, setFlagOnIndex]
}