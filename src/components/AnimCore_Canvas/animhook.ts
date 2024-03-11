import { AnimState, Api, ApiArgType } from "./animstate"
import { useEffect, useMemo, useReducer } from "react"

export function useAnimStateHook(animstate: AnimState) {
  const [_, forceUpdate] = useReducer(v=> v > 1000 ? 0 : v + 1, 0)

  useEffect(()=> {
    const onRebuild = ()=> forceUpdate()
    animstate.addEventListener("rebuildsymbolsource", onRebuild)
    return ()=> animstate.removeEventListener("rebuildsymbolsource", onRebuild)
  }, [animstate])

  const animHandlers = useMemo(()=> {
    const insertApi = (name: Api["name"], args: ApiArgType[], index?: number)=> {
      //@ts-ignore
      animstate.insert({name, args}, index)
      forceUpdate()
    }
    const enableApi = (index: number)=> {
      animstate.enableApi(index)
      forceUpdate()
    }
    const disableApi = (index: number)=> {
      animstate.disableApi(index)
      forceUpdate()
    }
    const deleteApi = (index: number)=> {
      animstate.deleteApi(index)
      forceUpdate()
    }
    const changeApiArg = (index: number, args: ApiArgType[])=> {
      animstate.changeApiArg(index, args)
      forceUpdate()
    }
    const rearrange = (from: number, to: number)=> {
      animstate.rearrange(from, to)
      forceUpdate()
    }
    const toggleFoldApi = (index: number)=> {
      const unfold = animstate.toggleFoldApi(index)
      forceUpdate()
      return unfold
    }
    const getLatestApi = ()=> {
      const list = animstate.getApiList()
      return list.length > 0 && list[list.length - 1]
    }
  
    return {
      insertApi,
      enableApi,
      disableApi,
      deleteApi,
      changeApiArg,
      rearrange,
      toggleFoldApi,
      getLatestApi,
      forceUpdate
    }
  }, [animstate])

  return animHandlers
}