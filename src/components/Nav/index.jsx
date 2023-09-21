import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Navbar, Alignment, Button, InputGroup, Checkbox } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { appWindow } from '@tauri-apps/api/window'
import MatchText from '../MatchText'
import { useOS } from '../../hooks'
import style from './style.module.css'
import { searchengine } from '../../asyncsearcher'

export default function Nav() {
  let { isWindows, isMacOS, isLinux } = useOS()
  const [query, setQueryString] = useState("")
  const [result, setSearchResult] = useState([])
  const [focus, setFocus] = useState(false)
  const resultRef = useRef()
  const [isCompisiting, setCompositing] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const navigate = useNavigate()

  const showResult = focus && (query.length >= 2 || !(/^[\x00-\x7F]+$/.test(query)) && query.length >= 1)

  useEffect(()=> {
    let changed = false
    requestAnimationFrame(()=> {
      if (showResult && !isCompisiting) {
        setLoading(true)
        searchengine.search(query).then(
          (result)=> {
            if (!changed){
              setSearchResult(result.map(item=> 
                window.assets_map[item.id]))
              setLoading(false)
            }
          }
        )
      }
    })
    return ()=> changed = true
  }, [showResult, query, isCompisiting])

  const handleDrag = ({target})=> {
    if (target.localName === "input") return
    if (target.localName === "button") return
    if (resultRef.current && resultRef.current.contains(target)) return
    appWindow.startDragging()
  }

  const handleSearch = ({target})=> {
    setQueryString(target.value.trim())
  }

  const gotoResultPage = ()=> {
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  const handleKey = useCallback(event=> {
    if (event.keyCode === 65 &&
      (isWindows && event.ctrlKey || isMacOS && event.metaKey || isLinux && event.ctrlKey ))
      {
        event.target.select()
      }
    else if (event.keyCode === 13 && query.length > 0) {
      gotoResultPage()
      setFocus(false)
    }
    else {
      setFocus(true)
    }
  }, [isWindows, isMacOS, isLinux, query])

  const handleCompositionStart = ()=> setCompositing(true)
  const handleCompositionEnd = ()=> setCompositing(false)

  return <Navbar style={{backgroundColor: "transparent", boxShadow: "none", width: "100%"}}
    onMouseDown={handleDrag}>
    <Navbar.Group align={Alignment.LEFT}>
      <Button className="bp4-minimal" icon="circle-arrow-left"
        disabled={history.length == 0}
        onClick={()=> navigate(-1)}/>
      <Button className="bp4-minimal" icon="circle-arrow-right" onClick={()=> navigate(1)}/>
    </Navbar.Group>
    <Navbar.Group align={Alignment.RIGHT}>
      {/* <Navbar.Heading>Title</Navbar.Heading> */}
      <div style={{position: "relative"}}>
        <InputGroup type="search" placeholder={"搜索"} 
          leftIcon="search" 
          autoComplete="off" 
          spellCheck="false" 
          className="allow-input"
          onChange={handleSearch} onKeyDown={handleKey}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={(event)=> { setFocus(true); setQueryString(event.target.value.trim())} } 
          onBlur={()=> setFocus(false)}/>
          {
            showResult && <QuickSearchResult 
              result={result} 
              resultRef={resultRef} 
              loading={isLoading}
              onClickMore={gotoResultPage}
              onClickItem={()=> setQueryString("")}/>
          }
      </div>
      <Navbar.Divider />
      <Button className="bp4-minimal" icon="home" text="Home" />
      <Button className="bp4-minimal" icon="document" text="Files" />
      {
        isWindows && <>
          <Navbar.Divider />
          <Button className="bp4-minimal" icon="small-minus" onClick={()=> appWindow.minimize()}/>
          <Button className="bp4-minimal" icon="small-square" onClick={()=> appWindow.toggleMaximize()}/>
          <Button className="bp4-minimal" icon="small-cross" onClick={()=> appWindow.close()}/>
        </>
      }
    </Navbar.Group>
  </Navbar>
}

function QuickSearchResult({result, resultRef, onClickItem, onClickMore, loading}) {
  const handleClick = (event)=> {
    event.preventDefault()
  }

  return (
    <div className={style["quick-search-result"]} ref={resultRef} onMouseDown={handleClick}>
      <div className={style['result-list']}>
        {
          Object.keys(
            Array.from({length: 1000})).map((_, index)=> {
              return index < result.length && <QuickSearchItem key={index} onClickItem={onClickItem} {...result[index]}/>
            })
        }
      </div>
      <div>
        {
          result.length === 0 ? <p>未找到结果。</p> :
          <p>找到了{result.length}个结果。<a onClick={onClickMore}>更多...</a></p>
        }
      </div>
      <div style={{position: "absolute", right: 10, bottom: 5, display: loading ? "block" : "none"}}>
        <Button minimal active={false} loading/>
      </div>
      {/* <div className='bp4-text-small'>
        <Switch label='全词匹配' inline={true} value={1} onChange={({target})=> setWholeWord(target.checked)}/>
      </div> */}
    </div>
  )
}

function QuickSearchItem(props) {
  const {type, file, id} = props
  const navigate = useNavigate()
  return <div style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}} onClick={()=> {
    props.onClickItem()
    // TODO: 词条和asset的区别
    navigate("/asset?id=" + encodeURIComponent(id))
  }}>
    {
      (type === "animzip" || type === "animdyn") ? 
        <MatchText text={file}  /> :
      (type === "xml") ? 
        <MatchText text={props.file} /> :
      (type === "tex") ?
        <MatchText text={props.tex} /> :
      (type == "tex_no_ref") ? 
        <MatchText text={props.file} /> :
      <></>
    }
  </div>
}
