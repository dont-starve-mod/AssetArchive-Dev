import React, { useCallback } from "react"
import { useLocation } from "react-router-dom"
import { useRef, useContext, useEffect, useState } from "react"
import cacheContext from "./cacheContext"
import { pageCacheNameSpace, capacityChoice, usePageCache } from "./cacheCapacity"

interface IProps {
  cacheNamespace: pageCacheNameSpace,
  cacheProfile?: capacityChoice,
  children: any,
}

export default function KeepAlivePage(props: IProps): React.JSX.Element {
  const {cacheNamespace, cacheProfile = "default"} = props
  let {cacheStates, mount, cache, drop} = useContext(cacheContext)
  let search = useLocation().search
  let ref = useRef<HTMLDivElement | null>(null)
  // let deleteFn = useCallback((items: string[])=> items.forEach(i=> drop(i)), [])
  let deleteFn = (v: string[])=> console.log("DELETE:", v)
  let { cache: lruCache } = usePageCache(cacheNamespace, deleteFn)
  window.cc = lruCache
  let cacheId = `${cacheNamespace}/${search}`
  useEffect(()=> {
    let state = cacheStates[cacheId]
    let articleRef: HTMLElement | undefined = cacheStates["@widget"]
    if (state && state.node) {
      // console.log('restore-node-page', cacheId)
      state.node.forEach((child: HTMLElement)=> ref.current?.appendChild(child))
      console.log(">>>>>", state.scrollTop | 0)
      if (articleRef){
        articleRef.scrollTop = state.scrollTop | 0
      }
    }
    else {
      // console.log("mount-page", cacheId)
      cache.set(cacheId, true)
      mount({cacheId, element: props.children})
    }
    return ()=> {
      const scrollTop = articleRef ? articleRef.scrollTop : 0
      console.log('unmount-page', cacheId, scrollTop)
      cache({id: cacheId, scrollTop})
    }
  }, [mount, cache, props, cacheStates, cacheId])

  return <div id={cacheId} ref={ref}/>
}