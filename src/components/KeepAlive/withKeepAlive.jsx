import cacheContext from "./cacheContext"
import { useContext, useEffect, useRef } from "react"

export default function withKeepAlive(Component, {cacheId}) {
  return function(props) {
    let {cacheStates, mount} = useContext(cacheContext)
    let ref = useRef()
    useEffect(()=> {
      let state = cacheStates[cacheId]
      if (state && state.node) {
        // console.log('restore-node', cacheId)
        state.node.forEach(child=> ref.current.appendChild(child))
      }
      else {
        // console.log('mount', cacheId)
        mount({cacheId, element: <Component {...props}/>})
      }
      // return ()=> console.log('unmount', cacheId)
    }, [mount, props])
    return <div id={cacheId} ref={ref}/>
  }
}
