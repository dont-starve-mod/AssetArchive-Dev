import { AnimState, Api, ApiArgType } from "./animstate"
import { useCallback, useEffect, useReducer } from "react"

export function useAnimStateHook(animstate: AnimState) {
  const [_, forceUpdate] = useReducer(v=> v > 1000 ? 0 : v + 1, 0)

  const insertApi = useCallback((name: Api["name"], args: ApiArgType[], index?: number)=> {
    //@ts-ignore
    animstate.insert({name, args}, index)
    forceUpdate()
  }, [])

  const enableApi = useCallback((index: number)=> {
    animstate.enableApi(index)
    forceUpdate()
  }, [])

  const disableApi = useCallback((index: number)=> {
    animstate.disableApi(index)
    forceUpdate()
  }, [])

  const deleteApi = useCallback((index: number)=> {
    animstate.deleteApi(index)
    forceUpdate()
  }, [])

  const changeApiArg = useCallback((index: number, args: ApiArgType[])=> {
    animstate.changeApiArg(index, args)
    forceUpdate()
  }, [])

  const rearrange = useCallback((from: number, to: number)=> {
    animstate.rearrange(from, to)
    forceUpdate()
  }, [])

  const toggleFoldApi = useCallback((index: number)=> {
    const unfold = animstate.toggleFoldApi(index)
    forceUpdate()
    return unfold
  }, [])

  useEffect(()=> {
    const onRebuild = ()=> forceUpdate()
    animstate.addEventListener("rebuildsymbolsource", onRebuild)
    return ()=> animstate.removeEventListener("rebuildsymbolsource", onRebuild)
  }, [])

  const getLatestApi = useCallback(()=> {
    const list = animstate.getApiList()
    return list.length > 0 && list[list.length - 1]
  }, [])

  return {
    insertApi,
    enableApi,
    disableApi,
    deleteApi,
    changeApiArg,
    rearrange,
    toggleFoldApi,
    getLatestApi,

    forceUpdate,
  }
}