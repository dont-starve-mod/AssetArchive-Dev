import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Navbar, Alignment, Button, InputGroup, Menu, MenuItem, Checkbox, Icon, IconName } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { appWindow } from '@tauri-apps/api/window'
import MatchText from '../MatchText'
import { useAppSetting, useOS } from '../../hooks'
import style from './style.module.css'
import { AllAssetTypes } from '../../searchengine'
import { Popover2 } from '@blueprintjs/popover2'
import { search } from '../../global_meilisearch'
import TinySlider from '../TinySlider'

export default function Nav() {
  let { isWindows, isMacOS, isLinux } = useOS()
  const [query, setQueryString] = useState("")
  const [result, setSearchResult] = useState([])
  const [estimatedTotalHits, setNumHits] = useState(0)
  const [focus, setFocus] = useState(false)
  const inputRef = useRef<HTMLInputElement>()
  const resultRef = useRef<HTMLDivElement>()
  const [isCompisiting, setCompositing] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const navigate = useNavigate()

  // const showResult = focus && (query.length >= 2 || !(/^[\x00-\x7F]+$/.test(query)) && query.length >= 1)
  const showResult = focus && query.length >= 1

  useEffect(()=> {
    if (showResult && !isCompisiting) {
      setLoading(true)
      search("assets", query, {limit: 1000, showMatchesPosition: true}).then(
        result=> {
          console.log(result.hits[0])
          if (result.query !== query) return
          setSearchResult(result.hits.map(({id, _matchesPosition})=> {
            return {
              matches: _matchesPosition,
              ...window.assets_map[id]
            }
          }))
          setNumHits(result.estimatedTotalHits)
          setLoading(false)
        }
      )
    }
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

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>)=> {
    if (event.key === "a" && // ctrl+A
      (isWindows && event.ctrlKey || isMacOS && event.metaKey || isLinux && event.ctrlKey ))
      {
        event.currentTarget.select()
      }
    else if (event.key === "Enter" && query.length > 0) {
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
          onChange={handleSearch} onKeyDown={onKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={(event)=> { setFocus(true); setQueryString(event.target.value.trim())} } 
          onBlur={()=> setFocus(false)}/>
          {
            showResult && <QuickSearchResult
              estimatedTotalHits={estimatedTotalHits} 
              result={result} 
              resultRef={resultRef} 
              loading={isLoading}
              onClickMore={gotoResultPage}
              onClickItem={()=> setQueryString("")}/>
          }
      </div>
      <Navbar.Divider/>
      <VolumeIcon/>
      <ColorThemeIcon/>
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

function VolumeIcon() {
  const [volume] = useAppSetting("volume")
  const [open, setOpen] = useState(false)
  const icon: IconName = volume > 50 ? "volume-up" : volume > 0 ? "volume-down" : "volume-off"
  return (
    <Popover2
      minimal
      // isOpen={open}
      placement="bottom"
      content={<VolumeSlider/>}>
      <Button
        minimal
        onClick={()=> setOpen(v=> !v)}
        icon={icon}
      />
    </Popover2>
  )
}

function VolumeSlider() {
  const [volume, setVolume] = useAppSetting("volume")
  return (
    <div style={{width: 100, height: 30, paddingTop: 5}} 
      onMouseDown={e=> e.stopPropagation()}>
      <TinySlider value={volume} min={0} max={100} onChange={setVolume}/>
    </div>
  )
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
      // isOpen={open} 
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

function QuickSearchResult({result, estimatedTotalHits, resultRef, onClickItem, onClickMore, loading}) {
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
          estimatedTotalHits === 0 ? <p>未找到结果。</p> :
          estimatedTotalHits > 1000 ? <p>找到了超过1000个结果。<a onClick={onClickMore}>更多...</a></p> :
          <p>找到了约{estimatedTotalHits}个结果。<a onClick={onClickMore}>更多...</a></p>
        }
      </div>
      <div style={{position: "absolute", right: 10, bottom: 5, display: loading ? "block" : "none"}}>
        <Button minimal active={false} loading/>
      </div>
      {/* <Checkbox/> */}
    </div>
  )
}

/** _matchesPosition field of meilisearch search result */
type Matches = {
  [K: string]: {start: number, length: number}[]
}

function QuickSearchItem(props: AllAssetTypes & { onClickItem: Function, matches: Matches }) {
  const {type, id, matches} = props
  const navigate = useNavigate()

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
          <MatchText text={props.file} match={matches["file"]}/> :
        (type === "xml") ? 
          <MatchText text={props.file} match={matches["file"]}/> :
        (type === "tex") ?
          <MatchText text={props.tex} match={matches["tex"]}/> :
        (type === "tex_no_ref") ? 
          <MatchText text={props.file} match={matches["file"]}/> :
        (type === "fmodevent") ? 
          <MatchText text={props.path} match={matches["path"]}/> :
        (type === "fmodproject") ?
          <MatchText text={props.file} match={matches["file"]}/> :
        <></>
      }
    </div>
  )
}
