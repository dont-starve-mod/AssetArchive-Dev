import { H3, Icon, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import { AllAssetTypes } from "../../searchengine"
import AssetDescFormatter from '../../components/AssetDescFormatter'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import cacheContext from '../../components/KeepAlive/cacheContext'
import style from "./index.module.css"
import { search, maxTotalHits, Result } from '../../global_meilisearch'
import { AccessableItem } from '../../components/AccessableItem'
import { useSelector } from '../../redux/store'
import { appWindow } from '@tauri-apps/api/window'

export default function SearchResultPage() {
  const location = useLocation()
  const [param] = useSearchParams()
  const query = param.get("q")

  const [flag, forceUpdate] = useReducer(v=> v + 1, 0)
  const [loading, setLoading] = useState(false)
  const [tab, selectTab] = useState<TabId>("all")
  const [result, setSearchResult] = useState<Result[]>([])

  // const {drop: dropCache} = useContext(cacheContext)

  const resultGroups = useMemo(()=> {
    let groups: {[K: string]: Result[]} = Object.fromEntries(
      SEARCH_RESULT_TYPE.map(({key})=> [key, []])
    )
    result.forEach(item=> groups[item.type].push(item))
    return groups
  }, [result])

  useEffect(()=> {
    if (!query) return
    setLoading(true)
    search("assets", query, {
      limit: maxTotalHits,
      showMatchesPosition: true,

    }).then(
      result=> {
        setSearchResult(result.hits.map(({id, _matchesPosition})=> {
          return {
            matches: _matchesPosition,
            ...window.assets_map[id]
          }
        }))
        setLoading(false)
      },
      e=> appWindow.emit("runtime_error", e)
    )
  }, [query, forceUpdate])

  console.log("Render", loading, tab, query, result.length)

  return <div>
    <KeepAlivePage key={query} cacheNamespace="searchPage">

    <H3>搜索 <span style={{color: "#6020d0"}}>{query}</span></H3>
      <div style={{borderBottom: "1px solid #ddd"}}>
        <GroupTag selected={tab === "all"} onClick={()=> selectTab("all")}>
          全部 {result.length + (result.length === maxTotalHits ? "+" : "")}
        </GroupTag>
        {
          SEARCH_RESULT_TYPE.map(({key, name})=> 
          <GroupTag selected={tab === key} key={key} onClick={()=> selectTab(key)}>
            {name} {resultGroups[key].length + (resultGroups[key].length === maxTotalHits ? "+" : "")}
          </GroupTag>)
        }
      </div>
      <div style={{width: 100, marginTop: 16, display: loading ? "block" : "none"}}>
        <Spinner/>
      </div>
      {
        !loading &&
        <div style={{overflowY: "auto", overflowX: "visible", maxHeight: "calc(100vh - 160px)"}}>
          <div>
          {
            tab === "all" && result.map((item, index)=> 
              <AccessableItem key={item.id} {...item}/>
            )
          }
          {
            tab !== "all" && resultGroups[tab].map((item, index)=> 
               <AccessableItem key={item.id} {...item}/>
            )
          }
          {
            <div className={style["no-result"]}>
              <p><Icon icon="search" style={{color: "#ccc", marginRight: 5}}/>
              没找到想要的结果？
              <a onClick={()=> alert("还没写完")}>反馈...</a></p>
            </div>
          }
          </div>
          
        </div>
      }
      <div>
    </div>
    </KeepAlivePage>
  </div>
}

function GroupTag({children, selected, onClick}) {
  return <Tag minimal interactive
    intent={selected ? "primary" : "none"}
    style={{margin: 4, marginLeft: 0}}
    onClick={()=> onClick()}>
    {children}
  </Tag>
}