import { AnimState, Api, ApiArgType } from "./animstate"
import { useCallback, useReducer } from "react"

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

  const changeApiArg = useCallback((index: number, args: ApiArgType[])=> {
    animstate.changeApiArg(index, args)
    forceUpdate()
  }, [])

  const rearrange = useCallback((from: number, to: number)=> {
    animstate.rearrange(from, to)
    forceUpdate()
  }, [])

  return {
    insertApi,
    enableApi,
    disableApi,
    changeApiArg,
    rearrange,
  }
}