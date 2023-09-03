import { useReducer, useCallback } from "react"
import { cacheActionTypes } from "./cacheActionTypes"
import cacheContext from "./cacheContext"

function cacheReducer(cacheStates, action) {
  let payload = action.payload
  let cacheId = payload.cacheId
  switch (action.type){
    case cacheActionTypes.SET_WIDGET:
      return {
        ...cacheStates,
        ["@widget"]: payload.node,
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
      return {
        ...cacheStates,
        [cacheId]: undefined,
      }
    default:
      return cacheStates
  }
}

export default function KeepAliveProvider(props) {
  let [cacheStates, dispatch] = useReducer(cacheReducer, {})
  window.cs = cacheStates
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
  return <cacheContext.Provider value={{cacheStates, setScrollableWidget, mount, cache, drop}}>
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