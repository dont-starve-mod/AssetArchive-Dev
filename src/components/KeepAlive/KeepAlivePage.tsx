import React, { useCallback } from "react"
import { useLocation } from "react-router-dom"
import { useRef, useContext, useEffect, useState } from "react"
import cacheContext from "./cacheContext"
import { pageCacheNameSpace, capacityChoice } from "./cacheCapacity"

interface IProps {
  cacheNamespace: pageCacheNameSpace,
  cacheProfile?: capacityChoice,
  cacheDependency?: React.DependencyList,
  children: any,
}

export default function KeepAlivePage(props: IProps): React.JSX.Element {
  const {cacheNamespace, cacheProfile = "default"} = props
  let {cacheStates, mount, cache, addRecord} = useContext(cacheContext)
  let search = useLocation().search
  let ref = useRef<HTMLDivElement | null>(null)
  let cacheId = `${cacheNamespace}/${search}`
  let scroll = useRef<number>(0)
  useEffect(()=> {
    let state = cacheStates[cacheId]
    let articleRef: HTMLElement | undefined = cacheStates["@widget"]
    if (state && state.node) {
      // console.log('restore-node-page', cacheId)
      state.node.forEach((child: HTMLElement)=> ref.current?.appendChild(child))
      scroll.current = state.scrollTop | 0
      if (articleRef){
        articleRef.scrollTop = state.scrollTop | 0
      }
      addRecord({namespace: cacheNamespace, cacheId})
    }
    else {
      // console.log("mount-page", cacheId)
      mount({cacheId, element: props.children})
      addRecord({namespace: cacheNamespace, cacheId})
    }
    return ()=> {
      const scrollTop = scroll.current
      // console.log('unmount-page', cacheId, scrollTop)
      if (state && state.scrollTop !== scrollTop) {
        cache({cacheId, scrollTop})
      }
    }
  }, [mount, cache, props, cacheStates, cacheId])

  useEffect(()=> {
    let articleRef: HTMLElement | undefined = cacheStates["@widget"]
    articleRef?.addEventListener("scroll", ({target})=> {
      scroll.current = (target as HTMLElement).scrollTop
    })
  }, [])

  return <div id={cacheId} ref={ref}/>
}