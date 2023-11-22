import { H3, Icon, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import { searchengine } from '../../asyncsearcher'
import { AllAssetTypes, FuseResult, Matches, Result } from "../../searchengine"
import AssetDescFormatter from '../../components/AssetDescFormatter'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import cacheContext from '../../components/KeepAlive/cacheContext'
import style from "./index.module.css"
import { search } from '../../global_meilisearch'
import { AccessableItem } from '../../components/AccessableItem'
import { useSelector } from '../../redux/store'

export default function SearchResultPage() {
  const location = useLocation()
  const [param] = useSearchParams()
  const query = param.get("q")

  const [flag, forceUpdate] = useReducer(v=> v + 1, 0)
  const [loading, setLoading] = useState(false)
  const [tab, selectTab] = useState<TabId>("all")
  const [result, setSearchResult] = useState<Result[]>([])

  const {drop: dropCache} = useContext(cacheContext)

  // classified results
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
    console.log(">>>>>")
    search("assets", query, {
      limit: 10000,
      showMatchesPosition: true,

    }).then(
      console.log,
      console.log,
      // (result: Array<FuseResult<AllAssetTypes>&{id: string, matches: Matches}>)=> {
      //   if (changed) return
      //   setSearchResult(result.map(item=> 
      //     ({...window.assets_map[item.id], ...item})))
      //   setLoading(false)
      //   dropCache({cacheId: "searchPage/" + location.search})
      // }
    )
  }, [query, forceUpdate])

  const maxResultNum = 500

  console.log("Render", loading, tab, query)

  return <div>
    <H3>搜索 <span style={{color: "#6020d0"}}>{query}</span></H3>
      <div style={{borderBottom: "1px solid #ddd"}}>
        <GroupTag selected={tab === "all"} onClick={()=> selectTab("all")}>
          全部 {result.length}
        </GroupTag>
        {
          SEARCH_RESULT_TYPE.map(({key, name})=> 
          <GroupTag selected={tab === key} key={key} onClick={()=> selectTab(key)}>
            {name} {resultGroups[key].length}
          </GroupTag>)
        }
      </div>
      <div style={{width: 100, marginTop: 16, display: loading ? "block" : "none"}}>
        <Spinner/>
      </div>
      {
        !loading &&
        <div style={{overflowY: "auto", overflowX: "visible", maxHeight: "calc(100vh - 160px)"}}>
          <KeepAlivePage key={query} cacheNamespace="searchPage">
            <div>

            
          {
            tab === "all" && result.map((item, index)=> 
              index < maxResultNum ? <AccessableItem key={item.id} {...item}/> :
              index === maxResultNum ? <ResultNumOverflow max={maxResultNum} num={result.length}/> :
              <></>)
          }
          {
            tab !== "all" && resultGroups[tab].map((item, index)=> 
              index < maxResultNum ? <AccessableItem key={item.id} {...item}/> :
              index === maxResultNum ? <ResultNumOverflow max={maxResultNum} num={resultGroups[tab].length}/> :
              <></>)
          }
          {
            <div className={style["no-result"]}>
              <p><Icon icon="search" style={{color: "#ccc", marginRight: 5}}/>
              没找到想要的结果？
              <a onClick={()=> alert("还没写完")}>反馈...</a></p>
            </div>
          }
          </div>
          </KeepAlivePage>
        </div>
      }
      <div>
    </div>
  </div>
}

function ResultNumOverflow(props: {max: number, num: number}) {
  const {max, num} = props
  return (
    <div>
      还有没显示的东西... max={max} num={num}
    </div>
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