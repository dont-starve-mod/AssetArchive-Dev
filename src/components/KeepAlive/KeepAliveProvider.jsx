import { useReducer, useCallback, useRef } from "react"
import { cacheActionTypes } from "./cacheActionTypes"
import cacheContext from "./cacheContext"
import { ResizableCache } from "./cacheCapacity"

function cacheReducer(cacheStates, action) {
  let payload = action.payload
  let cacheId = payload.cacheId
  switch (action.type){
    case cacheActionTypes.SET_WIDGET:
      if (cacheStates["@widget"] === payload.node){
        return cacheStates
      }
      else {
        return {
          ...cacheStates,
          ["@widget"]: payload.node,
        }
      }
    case cacheActionTypes.CREATING:
      // console.log(Object.keys(cacheStates))
      return {
        ...cacheStates,
        [cacheId]: {
          cacheId,
          element: payload.element,
          status: cacheActionTypes.CREATING,
        }

      }
    case cacheActionTypes.CREATED:
      return {
        ...cacheStates,
        [cacheId]: {
          ...cacheStates[cacheId],
          node: payload.node,
          status: cacheActionTypes.CREATED,
        }
      }
    case cacheActionTypes.SUSPENDED:
      return {
        ...cacheStates,
        [cacheId]: {
          ...cacheStates[cacheId],
          scrollTop: payload.scrollTop,
        }
      }
    case cacheActionTypes.DROP:
      delete cacheStates[cacheId]
      return {
        ...cacheStates,
      }
    default:
      return cacheStates
  }
}

export default function KeepAliveProvider(props) {
  const [cacheStates, dispatch] = useReducer(cacheReducer, {})
  const setScrollableWidget = useCallback(({node})=> {
    dispatch({type: cacheActionTypes.SET_WIDGET, payload: {node}})
  }, [])
  const mount = useCallback(({cacheId, element})=> {
    if (!cacheStates[cacheId]){
      dispatch({type: cacheActionTypes.CREATING, payload: {cacheId, element}})
    }
  }, [cacheStates])
  const cache = useCallback(({cacheId, scrollTop})=> {
    dispatch({type: cacheActionTypes.SUSPENDED, payload: {cacheId, scrollTop}})
  }, [])
  const drop = useCallback(({cacheId})=> {
    dispatch({type: cacheActionTypes.DROP, payload: {cacheId}})
  }, [])
  const cacheRecord = useRef({
    assetPage: new ResizableCache(3, item=> item.forEach(cacheId=> drop({cacheId}))),
    searchPage: new ResizableCache(3, item=> item.forEach(cacheId=> drop({cacheId}))),
  }).current
  const addRecord = useCallback(({namespace, cacheId})=> {
    cacheRecord[namespace].set(cacheId, true)
  }, [])
  return <cacheContext.Provider value={{cacheStates, setScrollableWidget, mount, cache, drop, addRecord}}>
    {props.children}
    {

      Object.entries(cacheStates).map(([key, value])=> {
        if (key === "@widget") return
        const {cacheId, element} = value
        return <div id={cacheId} key={cacheId} ref={node=> {
          let state = cacheStates[cacheId]
          if (node && !state.node){
            dispatch({type: cacheActionTypes.CREATED, payload: {cacheId, node: Array.from(node.childNodes)}})
          }
        }}>
          {
            element
          }
        </div>
      })
    }
  </cacheContext.Provider>
}