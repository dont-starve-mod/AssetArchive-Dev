import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Navbar, Alignment, Button, InputGroup, Checkbox } from '@blueprintjs/core'
import { RadioGroup, Radio, Switch, Icon } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { appWindow } from '@tauri-apps/api/window'
import MatchText from '../MatchText'
import { useOS } from '../../hooks'
import worker from '../../searchengine_worker'
import style from './style.module.css'

export default function Nav() {
  let { isWindows, isMacOS, isLinux } = useOS()
  const [qstr, setQueryString] = useState("")
  const [result, setSearchResult] = useState([])
  const [focus, setFocus] = useState(false)
  const [wholeWord, setWholeWord] = useState(false) // TODO: 这个应当为可保存的config
  const resultRef = useRef()
  // const [isLoading, setLoading] = useState(false)
  const navigate = useNavigate()

  const showResult = focus && (qstr.length >= 2 || !(/^[\x00-\x7F]+$/.test(qstr)) && qstr.length >= 1)
  
  useEffect(()=> {
    const onMessage = ({data})=> {
      if (data && data.result && data.source === "components/nav"){
        setSearchResult(data.result)
      }
    }
    worker.addEventListener("message", onMessage)
    return ()=> worker.removeEventListener("message", onMessage)
  }, [])

  useEffect(()=> {
    const token = requestAnimationFrame(()=> {
      if (showResult) {
        worker.postMessage({msg: "search", source: "components/nav", qstr, wholeWord})
      }
    })
    return ()=> cancelAnimationFrame(token)
  }, [showResult, qstr, wholeWord])

  const handleDrag = ({target})=> {
    if (target.localName === "input") return
    if (target.localName === "button") return
    if (resultRef.current && resultRef.current.contains(target)) return
    appWindow.startDragging()
  }

  const handleSearch = ({target})=> {
    setQueryString(target.value.trim())
  }

  const toResultPage = ()=> {
    appWindow.emit("search", {qstr, wholeWord})
    navigate(`/search?s=${encodeURIComponent(qstr)}&w=${wholeWord}`)
  }

  const handleKey = useCallback(event=> {
    if (event.keyCode === 65 &&
      (isWindows && event.ctrlKey || isMacOS && event.metaKey || isLinux && event.ctrlKey ))
      {
        event.target.select()
      }
    else if (event.keyCode === 13 && qstr.length > 0) {
      toResultPage()
      setFocus(false)
    }
    else {
      setFocus(true)
    }
  }, [isWindows, isMacOS, isLinux, qstr])

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
        <InputGroup type="search" placeholder={"搜索"} leftIcon="search" autoComplete="off" spellCheck="false" className='allow-input' 
          onChange={handleSearch} onKeyDown={handleKey}
          onFocus={(event)=> { setFocus(true); setQueryString(event.target.value.trim())} } 
          onBlur={()=> setFocus(false)}/>
          {
            showResult && <QuickSearchResult 
              result={result} 
              resultRef={resultRef} 
              wholeWord={wholeWord} setWholeWord={setWholeWord}
              onClickMore={toResultPage}
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

function QuickSearchResult({result, resultRef, wholeWord, setWholeWord, onClickItem, onClickMore}) {
  const handleClick = (event)=> {
    event.preventDefault()
  }

  return <div className={style["quick-search-result"]} ref={resultRef} onMouseDown={handleClick}>
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
        result.length === 0 && <p>未找到结果。</p>
      }
      {
        result.length > 0 && <>
          <p>找到了{result.length}个结果。<a onClick={onClickMore}>更多...</a></p>
        </>
      }
    </div>
    <div className='bp4-text-small'>
      <Switch label='全词匹配' inline={true} value={wholeWord} onChange={({target})=> setWholeWord(target.checked)}/>
    </div>
  </div>
}

function QuickSearchItem(props) {
  const {type, file, id} = props
  const navigate = useNavigate()
  return <div onClick={()=> {
    props.onClickItem()
    // TODO: 词条和asset的区别
    navigate("/asset?id=" + encodeURIComponent(id))
  }}>
    {
      (type === "animzip" || type === "animdyn") ? 
        <MatchText text={file} match={props.matches.file} /> :
      (type === "xml") ? 
        <MatchText text={props.file} match={props.matches.file} /> :
      (type === "tex") ?
        <MatchText text={props.tex} match={props.matches.tex} /> 
        :<>{console.log(type)}</>
    }
  </div>
}
