import React from "react"
import { useLocation } from "react-router-dom"
import { useRef, useContext, useEffect } from "react"
import cacheContext from "./cacheContext"
import { pageCacheNameSpace, capacityChoice } from "./cacheCapacity"

export interface KeepAlivePageProps {
  cacheNamespace: pageCacheNameSpace,
  cacheProfile?: capacityChoice,
  cacheDependency?: React.DependencyList,
  cacheId?: string,
  children: JSX.Element,
}

export default function KeepAlivePage(props: KeepAlivePageProps): React.JSX.Element {
  const {cacheNamespace, cacheProfile = "default"} = props
  let {cacheStates, mount, cache, addRecord} = useContext(cacheContext)
  let search = useLocation().search
  let ref = useRef<HTMLDivElement | null>(null)
  let cacheId = `${cacheNamespace}/${props.cacheId || search}`
  let scroll = useRef<number>(0)
  useEffect(()=> {
    let state = cacheStates[cacheId]
    let articleRef: HTMLElement | undefined = cacheStates["@widget"]
    if (state && state.node) {
      // console.log("restore-node-page", cacheId)
      state.node.forEach((child: HTMLElement)=> ref.current?.appendChild(child))
      scroll.current = state.scrollTop | 0
      if (articleRef){
        articleRef.scrollTop = state.scrollTop | 0
      }
      addRecord({namespace: cacheNamespace, cacheId})
      window.emit("restore_cache", {cacheId})
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
      window.emit("unmount_cache", {cacheId, scrollTop})
    }
  }, [mount, cache, props, cacheStates, cacheId, addRecord, cacheNamespace])

  useEffect(()=> {
    let articleRef: HTMLElement | undefined = cacheStates["@widget"]
    articleRef?.addEventListener("scroll", ({target})=> {
      scroll.current = (target as HTMLElement).scrollTop
    })
  }, [cacheStates])

  return <div id={cacheId} ref={ref}/>
}

// no keepalive behavior in debug mode
function KeepAlivePage_NoDev(props: KeepAlivePageProps) {
  return window.meta.debug ?
    props.children :
    <KeepAlivePage {...props}>{props.children}</KeepAlivePage>
}

KeepAlivePage.NoDev = KeepAlivePage_NoDev