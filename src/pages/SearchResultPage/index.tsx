import { Button, H3, H6, Icon, MenuItem, NumericInput, Radio, RadioGroup, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import { AllAssetTypes } from "../../searchengine"
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import style from "./index.module.css"
import { maxTotalHits, Response, isValid, searchWithCache } from '../../global_meilisearch'
import { AccessableItem } from '../../components/AccessableItem'
import { appWindow } from '@tauri-apps/api/window'
import { killPreviewSfx } from '../../components/Preview'
import { useSelector } from '../../redux/store'
import { Select2 } from '@blueprintjs/select'
import { Classes, Popover2 } from '@blueprintjs/popover2'
import { useLocalStorage } from '../../hooks'

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
          hits: result.hits.map(({id, _matchesPosition})=> {
            if (!window.assets_map[id])
              console.error("Failed to resolve id: " + id)
              // TODO: should not happen, why...
            else
              return {
                matches: _matchesPosition,
                ...window.assets_map[id],
              }
          }).filter(v=> Boolean(v))
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
      <H3>搜索 <span className="highlight-color">{query}</span></H3>
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
  const [currentPages, setTabCurrentPages] = useState(
    Object.fromEntries(SEARCH_RESULT_TYPE_ALL.map(({key})=> [key, 0])))
  const numResultsPerPage = useSelector(({localstorage})=> localstorage.num_search_results_per_page)
  // const numResultsPerPage = 10
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
    hits.forEach(item=> (groups[item.type] || groups["misc"]).push(item))
    groups["all"] = hits
    return groups
  }, [hits])

  const totalPages = Object.fromEntries(
    Object.entries(resultGroups).map(([k,v])=> 
      [k, {
        num: v.length,
        totalPage: Math.ceil(v.length / numResultsPerPage)
      }])
  )

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

  useEffect(()=> {
    let unlisten = appWindow.listen<any>("reset_search_page_number", ()=> {
      setTabCurrentPages(v=> Object.fromEntries(Object.keys(v).map(k=> [k, 0])))
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [setTabCurrentPages])

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
        <ResultPagesView 
          items={hits} 
          scrollZero={()=> {scroll.top.all = 1; setTabScroll("all")}}
          currentPage={currentPages["all"]}
          totalPage={totalPages["all"].totalPage}
          numResultsPerPage={numResultsPerPage}
          setCurrentPage={(v: number)=> setTabCurrentPages({...currentPages, all: v})}
          />
        <NoResult/>
      </div>
      <div>
        {
          SEARCH_RESULT_TYPE.map(({key})=>
           <div
            ref={node=> scroll.node[key] = node}
            onScroll={e=> scroll.top[key] = e.currentTarget.scrollTop}
            className={style["result-list"]} style={{display: tab === key ? "block" : "none"}} key={key}>
            <ResultPagesView
              items={resultGroups[key]}
              scrollZero={()=> {scroll.top[key] = 1; setTabScroll(key)}}
              currentPage={currentPages[key]}
              totalPage={totalPages[key].totalPage}
              numResultsPerPage={numResultsPerPage}
              setCurrentPage={(v: number)=> setTabCurrentPages({...currentPages, [key]: v})}
            />
            <NoResult/>
          </div>
          )
        }
      </div>
    </>
  )
}

type ResultPagesViewProps = {
  items: any[],
  currentPage: number,
  totalPage: number,
  numResultsPerPage: number,
  scrollZero: ()=> void,
  setCurrentPage: (page: number)=> void,
}

function ResultPagesView({items, currentPage, numResultsPerPage, totalPage, setCurrentPage, scrollZero}: ResultPagesViewProps) {
  const pageIndex = Math.min(Math.max(0, currentPage), totalPage - 1)
  const minIndex = pageIndex * numResultsPerPage
  const maxIndex = (pageIndex + 1)* numResultsPerPage - 1

  const nextPage = useCallback(()=> {
    setCurrentPage(Math.min(totalPage - 1, pageIndex + 1))
    scrollZero()
  }, [pageIndex, setCurrentPage, scrollZero])

  const prevPage = useCallback(()=> {
    setCurrentPage(Math.max(0, pageIndex - 1))
    scrollZero()
  }, [pageIndex, setCurrentPage, scrollZero])

  const firstPage = useCallback(()=> {
    setCurrentPage(0)
    scrollZero()
  }, [setCurrentPage, scrollZero])

  return (
    <>
      {
        items.map((item, index)=> {
          return index >= minIndex && index <= maxIndex && <AccessableItem {...item}/>
        })
      }
      <div style={{height: 10}}/>
      <Button icon="step-backward" disabled={pageIndex <= 0} onClick={firstPage}/>
      <div style={{display: "inline-block", width: 10}}/>
      <Button icon="arrow-left" disabled={pageIndex <= 0} onClick={prevPage}>
        上一页
      </Button>
      <div style={{display: "inline-block", padding: 5}}>
        {pageIndex + 1}/{totalPage}
      </div>
      <Button icon="arrow-right" disabled={pageIndex >= totalPage - 1} onClick={nextPage}>
        下一页
      </Button>
      <div style={{display: "inline-block", width: 10}}/>
      <PageNumSetter/>
    </>
  )
}

function PageNumSetter() {
  const [numResultsPerPage, setNumResultsPerPage] = useLocalStorage("num_search_results_per_page")
  return (
    <>
      <Popover2 
        minimal
        placement="right-end"
        content={<div className={`shadow-box ${Classes.POPOVER2_DISMISS}`} style={{padding: 10}}>
          <H6>每页展示的结果数量</H6>
          <RadioGroup selectedValue={numResultsPerPage} onChange={e=> setNumResultsPerPage(Number(e.currentTarget.value))}>
          {/* // onChange={e=> setNumResultsPerPage(e.currentTarget.value)}> */}
            <Radio label="50" value={50}/>
            <Radio label="100" value={100}/>
            <Radio label="200" value={200}/>
            <Radio label="500" value={500}/>
          </RadioGroup>
        </div>}
      >
        <Button icon="cog"/>
      </Popover2>
    </>
  )
}

function GroupTag({children, selected, onClick}) {
  return (
    <Tag 
      minimal 
      interactive
      intent={selected ? "primary" : "none"}
      style={{margin: 4, marginLeft: 0}}
      onClick={()=> onClick()}>
      {children}
    </Tag>
  )
}

function NoResult() {
  return (
    <div className={style["no-result"]}>
      <p>
        <Icon icon="search" style={{color: "#ccc", marginLeft: -10, marginRight: 5}}/>
        没找到想要的结果？
        <a onClick={()=> alert("这个还没写")}>反馈...</a></p>
    </div>
  )
}