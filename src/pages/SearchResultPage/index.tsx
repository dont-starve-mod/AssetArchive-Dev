import { H3, Icon, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import MatchText from '../../components/MatchText'
import { searchengine } from '../../asyncsearcher'
import { AllAssetTypes, FuseResult, Matches } from "../../searchengine"
import AssetDescFormatter from '../../components/AssetDescFormatter'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import Preview from '../../components/Preview'
import cacheContext from '../../components/KeepAlive/cacheContext'
import style from "./index.module.css"

type AssetItemProps = AllAssetTypes & FuseResult<AllAssetTypes> & { matches: Matches }

export default function SearchResultPage() {
  const location = useLocation()
  const [param] = useSearchParams()
  const query = param.get("q")

  const [flag, forceUpdate] = useReducer(v=> v + 1, 0)
  const [loading, setLoading] = useState(false)
  const [tab, selectTab] = useState<TabId>("all")
  const [result, setSearchResult] = useState<AssetItemProps[]>([])

  const {drop: dropCache} = useContext(cacheContext)

  // classified results
  const resultGroups = useMemo(()=> {
    let groups: {[K: string]: AssetItemProps[]} = Object.fromEntries(
      SEARCH_RESULT_TYPE.map(({key})=> [key, []])
    )
    result.forEach(item=> groups[item.type].push(item))
    return groups
  }, [result])

  useEffect(()=> {
    if (!query) return
    let changed = false
    setLoading(true)
    if (!searchengine.ready) {
      setTimeout(()=> forceUpdate(), 330)
      return
    }
    searchengine.search(query, null, "search").then(
      (result: Array<FuseResult<AllAssetTypes>&{id: string, matches: Matches}>)=> {
        if (changed) return
        setSearchResult(result.map(item=> 
          ({...window.assets_map[item.id], ...item})))
        setLoading(false)
        dropCache({cacheId: "searchPage/" + location.search})
      }
    )
    return ()=> { changed = true }
  }, [query, flag, forceUpdate])

  const maxResultNum = 500

  console.log("Render", loading, tab)

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
              index < maxResultNum ? <DetailedSearchItem key={item.id} {...item}/> :
              index === maxResultNum ? <ResultNumOverflow max={maxResultNum} num={result.length}/> :
              <></>)
          }
          {
            tab !== "all" && resultGroups[tab].map((item, index)=> 
              index < maxResultNum ? <DetailedSearchItem key={item.id} {...item}/> :
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

const PREIVEW_SIZE = { width: 50, height: 50 }
const MARK_STYLE: React.CSSProperties = { color: "#6020d0", fontWeight: 800 }

function DetailedSearchItem(props: AssetItemProps & { matches: Matches }){
  const {type, id, description, matches} = props
  const matchesMap = Object.fromEntries(
    matches.map(({key, indices})=> [key, indices as [number, number][]])
  )
  const navigate = useNavigate()
  return <div 
    className={style["search-item-box"]}
    onClick={()=> {
      // props.onClickItem()
      // TODO: 词条和asset的区别
      navigate("/asset?id=" + encodeURIComponent(id))
    }}>
    <div className={style["left"]}>
      <H3>
        {
          (type === "animzip" || type === "animdyn") ? 
            <MatchText text={props.file} match={matchesMap["file"]} markStyle={MARK_STYLE}/> :
          type === "xml" ? 
            <MatchText text={props.file} match={matchesMap["file"]} markStyle={MARK_STYLE}/> :
          type === "tex" ?
            <MatchText text={props.tex} match={matchesMap["tex"]} markStyle={MARK_STYLE}/> :
          // type === "tex_no_ref" && props._is_cc ?
            
          type === "tex_no_ref" ?
            <MatchText text={props.file} match={matchesMap["file"]} markStyle={MARK_STYLE}/> :
          <></>
        }
      </H3>
      <p>
        {
          
          description &&
          <AssetDescFormatter.PlainText description={description}/>
        }
      </p>
    </div>
    <div className={style["preview-box"] + " bp4-elevation-1"} style={{...PREIVEW_SIZE}}>
      {
        type === "tex" ? 
          <Preview.Image {...props} {...PREIVEW_SIZE}/> :
        type === "xml" ? 
          <Preview.XmlMap {...props} {...PREIVEW_SIZE}/> :
        type === "animzip" || type === "animdyn" ? 
          <Preview.Zip {...props} {...PREIVEW_SIZE}/> :
        type === "tex_no_ref" && props._is_cc === true ?
          <Preview.CC {...props} {...PREIVEW_SIZE} cc={props.file} 
          sourceType={"image"}
          xml={"images/bg_loading_loading_farming.xml"} 
          tex={"loading_farming.tex"}/> :
        type === "tex_no_ref" ? 
          <Preview.Texture {...props} {...PREIVEW_SIZE}/> :
         <></>
      }
    </div>
  </div>
}