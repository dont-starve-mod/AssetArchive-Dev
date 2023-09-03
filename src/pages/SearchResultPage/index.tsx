import { H3, Spinner } from '@blueprintjs/core'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Tab, Tabs } from '@blueprintjs/core'
import { SEARCH_RESULT_TYPE } from '../../strings'
import MatchText from '../../components/MatchText'
import { startSearching, worker } from '../../searchengine_worker'
import { AllAssetTypes } from '../../datatype'
import style from "./index.module.css"
import { appWindow } from '@tauri-apps/api/window'

export default function SearchResultPage() {
  const [param] = useSearchParams()
  const qstr = param.get("s")
  const wholeWord = param.get("w") === "true"
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [tab, selectTab] = useState<string>(SEARCH_RESULT_TYPE[0].key)
  const [result, setSearchResult] = useState<AllAssetTypes[]>([])

  useEffect(()=> {
    const onMessage = ({data})=> {
      if (data && data.result && data.source === "pages/searchresultpage"){
        setLoading(false)
        setSearchResult(data.result)
        
      }
    }
    worker.addEventListener("message", onMessage)
    return ()=> worker.removeEventListener("message", onMessage)
  }, [])

  useEffect(()=> {
    const unlisten = appWindow.listen("search", ({payload})=> {
      if ((payload as any).qstr !== qstr) {
        setLoading(true)
      }
    })
    return ()=> unlisten.then(f=> f()) as any
  }, [qstr])

  // 对搜索结果进行一些预处理
  const resultGroups = useMemo(()=> {
      let r = Object.fromEntries(
        SEARCH_RESULT_TYPE.map(({key})=> [key, [] as AllAssetTypes[]])
      )
      result.forEach(item=> r[item.type].push(item))
      return r
  }, [result])

  useEffect(()=> {
    const token = setInterval(()=> {
      const result = startSearching(qstr, wholeWord, "pages/searchresultpage")
      if (result === "skip"){ }
      else if (result === "submitted"){
        setLoading(true)
        setSearchResult([])
        clearInterval(token)
      }
      else if(result === "pending"){
        // continue tick
      }
      else {
        setLoading(false)
        setSearchResult(result as any[])
        clearInterval(token)
      }
    }, 200)
    return ()=> clearInterval(token)
  }, [qstr, wholeWord])

  return <div>
    <H3>搜索 <span style={{color: "#6020d0"}}>{qstr}</span></H3>
    <div style={{borderBottom: "1px solid #ddd"}}>
      <Tabs id="TabsExample" onChange={v=> selectTab(v as string)} selectedTabId={tab}>
        {
          SEARCH_RESULT_TYPE.map(({key, name})=> 
            <Tab id={key} key={key} 
              title={name} 
              tagContent={resultGroups[key].length}
              disabled={resultGroups[key].length === 0}
            />
          )
        }
      </Tabs>
    </div>
    {
      loading && <div style={{width: 100, marginTop: 16}}>
        <Spinner/>
      </div>
    }
    <div style={{overflowY: "scroll", maxHeight: "calc(100vh - 160px)"}}>
      {
        !loading && result.map(item=> <DetailedSearchItem key={item.key} {...item}/>)
      }
    </div>
  </div>
}

function DetailedSearchItem(props: AllAssetTypes){
  const {type, file, id} = props
  const navigate = useNavigate()
  return <div className={style["search-item-box"]} onClick={()=> {
    // props.onClickItem()
    // TODO: 词条和asset的区别
    navigate("/asset?id=" + encodeURIComponent(id))
  }}>
    <H3>
      {
        (type === "animzip" || type === "animdyn") ? 
          <MatchText text={file} match={props.matches.file} /> :
        (type === "xml") ? 
          <MatchText text={props.file} match={props.matches.file} /> :
        (type === "tex") ?
          <MatchText text={props.tex} match={props.matches.tex} /> :
        (type === "tex_no_ref") ?
          <MatchText text={props.file} match={props.matches.file} /> :
        <></>
      }
    </H3>
  </div>
}