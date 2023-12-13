import { H3, Icon, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import { AllAssetTypes } from "../../searchengine"
import AssetDescFormatter from '../../components/AssetDescFormatter'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import style from "./index.module.css"
import { maxTotalHits, Response, isValid, searchWithCache } from '../../global_meilisearch'
import { AccessableItem } from '../../components/AccessableItem'
import { appWindow } from '@tauri-apps/api/window'
import { killPreviewSfx } from '../../components/Preview'
import { useSelector } from '../../redux/store'

// TODO: 该组件的保活机制还有一些问题，需要深入测试

const SEARCH_RESULT_TYPE_ALL = [
  {
    key: "all"
  },
  ...SEARCH_RESULT_TYPE,
]

export default function SearchResultPage() {
  const [param] = useSearchParams()
  const query = param.get("q")

  const [flag, forceUpdate] = useReducer(v=> v + 1, 0)
  const [loading, setLoading] = useState(true)
  const [result, setSearchResult] = useState<Response>()

  // const {drop: dropCache} = useContext(cacheContext)

  useEffect(()=> {
    if (!query) return
    setLoading(true)
    if (!isValid()){
      setTimeout(forceUpdate, 500)
      return
    }
    searchWithCache("assets", query, {
      limit: maxTotalHits,
      showMatchesPosition: true,
    }).then(
      result=> {
        setSearchResult({
          ...result,
          hits: result.hits.map(({id, _matchesPosition})=> ({
            matches: _matchesPosition,
            ...window.assets_map[id]
          }))
        })
        setLoading(false)
      },
      e=> {
        console.error(e)
        appWindow.emit("runtime_error", e)
      }
    )
  }, [query, flag])

  return (
    <div>
      <H3>搜索 <span style={{color: "#6020d0"}}>{query}</span></H3>
      {
        loading && 
        <div style={{width: 100, marginTop: 16, display: loading ? "block" : "none"}}>
          <Spinner/>
        </div>
      }
      {
        !loading &&
        <KeepAlivePage
          key={result.query}
          cacheNamespace="searchPage"
          cacheId={result.query}>
          <SearchResultDisplay result={result}/>
        </KeepAlivePage>
      }
    </div>
  )
}

function SearchResultDisplay({result}: {result: Response}) {
  const {query, hits} = result
  const [tab, selectTab] = useState<TabId>("all")
  const [currentPage, setTabCurrentPage] = useState(
    Object.fromEntries(SEARCH_RESULT_TYPE_ALL.map(({key})=> [key, 0])))
  const numResultsPerPage = useSelector(({appsettings})=> appsettings.num_search_results)
  const scroll = useRef<{
    top: {[K: string]: number},
    node: {[K: string]: HTMLDivElement},
  }>({
    top: Object.fromEntries(SEARCH_RESULT_TYPE_ALL.map(({key})=> [key, 0])),
    node: { }
  }).current

  const resultGroups = useMemo(()=> {
    // TODO: fix type
    let groups: {[K: string]: any[]} = Object.fromEntries(
      SEARCH_RESULT_TYPE_ALL.map(({key})=> [key, []])
    )
    hits.forEach(item=> groups[item.type].push(item))
    groups["all"] = hits
    return groups
  }, [hits])

  const resultNums = Object.fromEntries(
    Object.entries(resultGroups).map(([k,v])=> 
      [k, {
        num: v.length,
        totalPage: Math.ceil(v.length / numResultsPerPage)
      }])
  )

  console.log(resultNums)

  const setTabScroll = useCallback((key: TabId)=> {
    if ((scroll.top[key] || 0) > 0 && scroll.node[key] && scroll.top[key] !== scroll.node[key].scrollTop){
      scroll.node[key].scrollTop = scroll.top[key]
      if (scroll.node[key].scrollTop !== scroll.top[key]){
        console.warn("Failed to restore tab scroll", key)
      }
    }
  }, [])

  useEffect(()=> {
    setTabScroll(tab)
  }, [tab])

  useEffect(()=> {
    let unlisten = appWindow.listen<any>("restore_cache", ({payload: {cacheId}})=> {
      if (cacheId.startsWith("searchPage") && cacheId.endsWith(query)){
        setTabScroll(tab)
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [tab, query])

  useEffect(()=> {
    let unlisten = appWindow.listen<any>("unmount_cache", ({payload: {cacheId}})=> {
      if (cacheId.startsWith("searchPage")){
        killPreviewSfx()
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  return (
    <>
      <div style={{borderBottom: "1px solid #ddd"}}>
        <GroupTag selected={tab === "all"} onClick={()=> selectTab("all")}>
          全部 {hits.length + (hits.length === maxTotalHits ? "+" : "")}
        </GroupTag>
        {
          SEARCH_RESULT_TYPE.map(({key, name})=> 
          <GroupTag selected={tab === key} key={key} onClick={()=> selectTab(key)}>
            {name} {resultGroups[key].length + (resultGroups[key].length === maxTotalHits ? "+" : "")}
          </GroupTag>)
        }
      </div>
      <div
        ref={node=> scroll.node["all"] = node}
        onScroll={e=> scroll.top["all"] = e.currentTarget.scrollTop}
        className={style["result-list"]} 
        style={{display: tab === "all" ? "block" : "none"}}>
        {
          hits.map((item)=> 
            <AccessableItem key={item.id} {...item}/>
          )
        }
        <NoResult/>
      </div>
      <div>
        {
          SEARCH_RESULT_TYPE.map(({key})=>
          <div
            ref={node=> scroll.node[key] = node}
            onScroll={e=> scroll.top[key] = e.currentTarget.scrollTop}
            className={style["result-list"]} style={{display: tab === key ? "block" : "none"}} key={key}>
            {
              resultGroups[key].map(item=> 
                <AccessableItem key={item.id} {...item}/>
              )
            }
            <NoResult/>
          </div>
          )
        }
      </div>
    </>
  )
} 

function GroupTag({children, selected, onClick}) {
  return <Tag minimal interactive
    intent={selected ? "primary" : "none"}
    style={{margin: 4, marginLeft: 0}}
    onClick={()=> onClick()}>
    {children}
  </Tag>
}

function NoResult() {
  return (
    <div className={style["no-result"]}>
      <p>
        <Icon icon="search" style={{color: "#ccc", marginRight: 5}}/>
        没找到想要的结果？
        <a onClick={()=> alert("这个还没写")}>反馈...</a></p>
    </div>
  )
}