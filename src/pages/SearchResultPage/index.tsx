import { H3, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import { AllAssetTypes } from "../../searchengine"
import AssetDescFormatter from '../../components/AssetDescFormatter'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import style from "./index.module.css"
import { search, maxTotalHits, Response, isValid } from '../../global_meilisearch'
import { AccessableItem } from '../../components/AccessableItem'
import { appWindow } from '@tauri-apps/api/window'

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
    search("assets", query, {
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
        <KeepAlivePage key={result.query} cacheId={result.query} cacheNamespace="searchPage">
          <SearchResultDisplay result={result}/>
        </KeepAlivePage>
      }
    </div>
  )
}

function SearchResultDisplay({result}: {result: Response}) {
  const {query, hits} = result
  const [tab, selectTab] = useState<TabId>("all")
  const resultGroups = useMemo(()=> {
    // TODO: fix type
    let groups: {[K: string]: any[]} = Object.fromEntries(
      SEARCH_RESULT_TYPE.map(({key})=> [key, []])
    )
    hits.forEach(item=> groups[item.type].push(item))
    return groups
  }, [hits])

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
        
        <div className={style["result-list"]} style={{display: tab === "all" ? "block" : "none"}}>
          {
            hits.map((item)=> 
              <AccessableItem key={item.id} {...item}/>
            )
          }
        </div>
        <div>
          {
            SEARCH_RESULT_TYPE.map(({key})=>
            <div className={style["result-list"]} style={{display: tab === key ? "block" : "none"}} key={key}>
              {
                resultGroups[key].map(item=> 
                  <AccessableItem key={item.id} {...item}/>
                )
              }
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