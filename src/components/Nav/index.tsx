import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Navbar, Alignment, Button, InputGroup, Menu, MenuItem, Checkbox } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { appWindow } from '@tauri-apps/api/window'
import MatchText from '../MatchText'
import { useAppSetting, useOS } from '../../hooks'
import style from './style.module.css'
import { searchengine } from '../../asyncsearcher'
import { AllAssetTypes, Matches } from '../../searchengine'
import { Popover2 } from '@blueprintjs/popover2'

export default function Nav() {
  let { isWindows, isMacOS, isLinux } = useOS()
  const [query, setQueryString] = useState("")
  const [result, setSearchResult] = useState([])
  const [focus, setFocus] = useState(false)
  const inputRef = useRef<HTMLInputElement>()
  const resultRef = useRef<HTMLDivElement>()
  const [isCompisiting, setCompositing] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const navigate = useNavigate()

  const showResult = focus && (query.length >= 2 || !(/^[\x00-\x7F]+$/.test(query)) && query.length >= 1)
  
  useEffect(()=> {
    let changed = false
    requestAnimationFrame(()=> {
      if (showResult && !isCompisiting) {
        setLoading(true)
        searchengine.search(query, "", "search").then(
          (result)=> {
            if (!changed){
              setSearchResult(result.map(item=> 
                ({
                  matches: item.matches, 
                  ...window.assets_map[item.id]
                })
              ))
              setLoading(false)
            }
          }
        )
      }
    })
    return ()=> { changed = true }
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
    if (event.keyCode === 65 && // ctrl+A
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

  const [closeButtonFocus, setCloseButtonFocus] = useState(false)

  useEffect(()=> {
    const unlisten = appWindow.listen("start_search", ()=> {
      // setFocus(true)
      inputRef.current?.focus()
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

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
          inputRef={inputRef}
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
      <ColorThemeIcon />
      {
        isWindows && <>
          <Navbar.Divider />
          <Button minimal icon="minus" onClick={()=> appWindow.minimize()}/>
          <Button minimal icon="small-square" onClick={()=> appWindow.toggleMaximize()}/>
          <Button minimal icon="cross" intent={closeButtonFocus ? "danger" : "none"}
            onMouseOver={()=> setCloseButtonFocus(true)}
            onMouseLeave={()=> setCloseButtonFocus(false)}
            onClick={()=> appWindow.close()}/>
        </>
      }
    </Navbar.Group>
  </Navbar>
}

function ColorThemeIcon() {
  const [theme] = useAppSetting("theme")
  const [systemTheme] = useAppSetting("systemTheme")
  const [open, setOpen] = useState(false)

  const isDarkMode = (theme === "auto" ? systemTheme : theme) === "dark"
  const icon = isDarkMode ? "moon" : "flash"

  return (
    <Popover2 
      minimal 
      isOpen={open} 
      content={<ColorThemePicker closeMenu={()=> setOpen(false)}/>}>
      <Button
        minimal
        onClick={()=> setOpen(v=> !v)}
        icon={icon}
      />
    </Popover2>
  )
}

function ColorThemePicker(props: any) {
  const [theme, setTheme] = useAppSetting("theme")
  return (
    <Menu style={{minWidth: 125}} onClick={()=> props.closeMenu()}>
      <MenuItem selected={theme === "light"} onClick={()=> setTheme("light")} icon="flash" text='浅色'/>
      <MenuItem selected={theme === "dark"} onClick={()=> setTheme("dark")} icon="moon" text='深色'/>
      <MenuItem selected={theme === "auto"} onClick={()=> setTheme("auto")} icon="desktop" text='跟随系统'/>
    </Menu>
  )
}

function QuickSearchResult({result, resultRef, onClickItem, onClickMore, loading}) {
  return (
    <div className={style["quick-search-result"]} ref={resultRef} onMouseDown={e=> e.preventDefault()}>
      <div className={style['result-list']}>
        {
          Object.keys(
            Array.from({length: 1000})).map((_, index)=> {
              return index < result.length && 
              <QuickSearchItem key={index} onClickItem={onClickItem} {...result[index]}/>
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
      {/* <Checkbox/> */}
    </div>
  )
}

function QuickSearchItem(props: AllAssetTypes & { onClickItem: Function, matches: Matches }) {
  const {type, id, matches} = props
  const navigate = useNavigate()
  const matchesMap = Object.fromEntries(
    matches.map(({key, indices})=> [key, indices])
  )
  return (
    <div 
      style={{textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden"}} 
      onClick={()=> {
        props.onClickItem()
        // TODO: 词条和asset的区别
        navigate("/asset?id=" + encodeURIComponent(id))
      }}>
      {
        (type === "animzip" || type === "animdyn") ? 
          <MatchText text={props.file} match={matchesMap["file"]}/> :
        (type === "xml") ? 
          <MatchText text={props.file} match={matchesMap["file"]}/> :
        (type === "tex") ?
          <MatchText text={props.tex} match={matchesMap["tex"]}/> :
        (type == "tex_no_ref") ? 
          <MatchText text={props.file} match={matchesMap["file"]}/> :
        <></>
      }
    </div>
  )
}
