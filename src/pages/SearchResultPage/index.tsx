import { Button, H3, H6, Icon, Radio, RadioGroup, Spinner, TabId, Tag } from '@blueprintjs/core'
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SEARCH_RESULT_TYPE } from '../../strings'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import style from "./index.module.css"
import { maxTotalHits, Response, search, SEARCHABLE_FIELDS, isSearchable } from '../../global_meilisearch'
import { AccessableItem } from '../../components/AccessableItem'
import { killPreviewSfx } from '../../components/Preview'
import { useSelector } from '../../redux/store'
import { Classes, Popover2 } from '@blueprintjs/popover2'
import { useLocalStorage } from '../../hooks'
import PageTurner from '../../components/PageTurner'
import { invoke } from '@tauri-apps/api/core'

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
  const tab = param.get("tab")

  const [flag, forceUpdate] = useReducer(v=> v + 1, 0)
  const [loading, setLoading] = useState(true)
  const [result, setSearchResult] = useState<Response>()

  // const {drop: dropCache} = useContext(cacheContext)

  useEffect(()=> {
    if (!query) return
    setLoading(true)
    if (!isSearchable()){
      setTimeout(forceUpdate, 500)
      return
    }
    search("assets", query, {
      limit: maxTotalHits,
      showMatchesPosition: true,
      // animationList is removed from searchable fields to make bank result accurate
      attributesToSearchOn: SEARCHABLE_FIELDS.filter(v=> v !== "animationList"),
    }).then(
      result=> {
        setSearchResult({
          ...result,
          hits: result.hits.map(({id, _matchesPosition})=> {
            return window.assets_map[id] && window.assets_map[id].type &&
            {
              matches: _matchesPosition,
              ...window.assets_map[id],
            }
          }).filter(v=> Boolean(v))
        })
        setLoading(false)
      },
      e=> {
        console.error(e)
        window.emit("runtime_error", e.name)
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
          // key={result.query}
          key={`${result.query} [${result.hits.length}]`} // update cache if results changed
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
  const [params, setParams] = useSearchParams()
  const tabQ = params.get("tab") as TabId
  const selectTab = useCallback((tab: TabId)=> {
    setParams(v=> {
      v.set("tab", tab as string)
      return v
    })
  }, [setParams])
  const tab = (SEARCH_RESULT_TYPE_ALL.find(v=> v.key === tabQ) || {key: "all"}).key
  // const [tab, selectTab] = useState<TabId>("all")
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
  }, [scroll])

  useEffect(()=> {
    setTabScroll(tab)
  }, [tab, setTabScroll])

  useEffect(()=> {
    let unlisten = window.listen<any>("restore_cache", ({payload: {cacheId}})=> {
      if (cacheId.startsWith("searchPage") && cacheId.endsWith(query)){
        setTabScroll(tab)
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [tab, query, setTabScroll])

  useEffect(()=> {
    let unlisten = window.listen<any>("unmount_cache", ({payload: {cacheId}})=> {
      if (cacheId.startsWith("searchPage")){
        killPreviewSfx()
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    let unlisten = window.listen<any>("reset_search_page_number", ()=> {
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
          // @ts-ignore
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
  }, [pageIndex, setCurrentPage, scrollZero, totalPage])

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
      <div style={{display: "inline-block", marginRight: 10}}>
        <PageTurner 
          page={pageIndex} 
          totalPage={totalPage} 
          prev={prevPage}
          next={nextPage}
          first={firstPage}
          last={()=> {}}
        />
      </div>
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
    <div className="ml-3 mt-3 mb-10">
      <p>
        <Icon icon="search" style={{color: "#ccc", marginLeft: -10, marginRight: 5}}/>
        没找到想要的结果？
        <a onClick={()=> invoke("open_url", { url: "https://support.qq.com/product/632056/" })}>反馈...</a></p>
    </div>
  )
}