import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Navbar, Alignment, Button, InputGroup, Menu, MenuItem, Checkbox, Icon, IconName } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { appWindow } from '@tauri-apps/api/window'
import MatchText from '../MatchText'
import { useAppSetting, useOS } from '../../hooks'
import style from './style.module.css'
import { ArchiveItem } from '../../searchengine'
import { Popover2 } from '@blueprintjs/popover2'
import { SEARCHABLE_FIELDS, search } from '../../global_meilisearch'
import TinySlider from '../TinySlider'
import Hash, { useHashToString } from '../HumanHash'

export default function Nav() {
  let { isWindows, isMacOS, isLinux } = useOS()
  const [query, setQueryString] = useState("")
  const [result, setSearchResult] = useState([])
  const [estimatedTotalHits, setNumHits] = useState(0)
  const [focus, setFocus] = useState(false)
  const inputRef = useRef<HTMLInputElement>()
  const resultRef = useRef<HTMLDivElement>()
  const noDragRef = useRef<Set<HTMLElement>>(new Set())
  const [isCompisiting, setCompositing] = useState(false)
  const [isLoading, setLoading] = useState(false)
  const navigate = useNavigate()

  // const showResult = focus && (query.length >= 2 || !(/^[\x00-\x7F]+$/.test(query)) && query.length >= 1)
  const showResult = focus && query.length >= 1

  useEffect(()=> {
    if (showResult && !isCompisiting) {
      setLoading(true)
      search("assets", query, {
        limit: 1000,
        showMatchesPosition: true,
        attributesToSearchOn: SEARCHABLE_FIELDS.filter(v=> v!== "animationList")
      }).then(
        result=> {
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
    if (!isMacOS){
      // webview2 in windows easily lose cursor focus after dragging
      for (let v of noDragRef.current) {
        if (v.contains(target)) return
      }
    }
    appWindow.startDragging()
  }

  const handleSearch = ({target})=> {
    setQueryString(target.value.trim())
  }

  const gotoResultPage = ()=> {
    navigate(`/search?q=${encodeURIComponent(query)}`)
    setFocus(false)
  }

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>)=> {
    if (event.key === "a" && // ctrl+A
      (isWindows && event.ctrlKey || isMacOS && event.metaKey || isLinux && event.ctrlKey ))
      {
        event.currentTarget.select()
      }
    else if (event.key === "Enter" && query.length > 0) {
      // gotoResultPage()
      // setFocus(false)
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

  return (
    <Navbar
      className={style["navbar"]} 
      onMouseDown={handleDrag}>
      <Navbar.Group align={Alignment.LEFT}>
        <div ref={v=> {if (v) {noDragRef.current.add(v)}}}>
          <Button className="bp4-minimal" icon="circle-arrow-left"
            disabled={window.history.length === 0}
            onClick={()=> navigate(-1)}/>
          <Button className="bp4-minimal" icon="circle-arrow-right" onClick={()=> navigate(1)}/>
        </div>
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
        <div className="flex items-center" 
          ref={v=> {if (v) noDragRef.current.add(v)}}>
        <VolumeIcon/>
        <ColorThemeIcon/>
        {
          isWindows && <>
            <Navbar.Divider />
            <Button minimal icon="minus" 
              onClick={(e: React.MouseEvent<HTMLElement>)=> {
                appWindow.minimize()
                e.preventDefault()
              }}/>
            <Button minimal icon="small-square" 
              onClick={(e: React.MouseEvent<HTMLElement>)=> {
                appWindow.toggleMaximize()
                e.preventDefault()
              }}/>
            <Button minimal icon="cross" intent={closeButtonFocus ? "danger" : "none"}
              onMouseOver={()=> setCloseButtonFocus(true)}
              onMouseLeave={()=> setCloseButtonFocus(false)}
              onClick={(e:React.MouseEvent<HTMLElement>)=> {
                appWindow.close()
                e.preventDefault()
              }}/>
          </>
        }
        </div>
      </Navbar.Group>
    </Navbar>
  )
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
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const maxIndex = result.length - 1
  const listRef = useRef<HTMLDivElement>()
  const elements = useRef<{[index: number]: HTMLDivElement}>({}).current

  useEffect(()=> {
    // clear selection when result changes
    setSelectedIndex(-1)
  }, [setSelectedIndex, result])

  const scrollActiveItemIntoView = useCallback((index: number)=> {
    const list = listRef.current
    const div = elements[index]
    if (list && div) {
      const {top: listTop, bottom: listBottom} = list.getBoundingClientRect()
      const {top: divTop,  bottom: divBottom} = div.getBoundingClientRect()
      if (divTop < listTop){
        list.scrollTop += divTop - listTop
      }
      else if (divBottom > listBottom){
        list.scrollTop += divBottom - listBottom
      }
    }
  }, [elements])

  useEffect(()=> {
    // TODO: fix delay between background color and scroll
    scrollActiveItemIntoView(selectedIndex)
  })

  const navigate = useNavigate()

  useEffect(()=> {
    const onKeyDown = (event: KeyboardEvent)=> {
      if (event.key === "ArrowDown"){
        setSelectedIndex(v=> {
          let index = Math.min(v + 1, maxIndex)
          // scrollActiveItemIntoView(index)
          return index
        })
      }
      else if (event.key === "ArrowUp"){
        setSelectedIndex(v=> {
          let index = Math.max(0, v - 1)
          // scrollActiveItemIntoView(index)
          return index
        })
      }
      else if (event.key === "Enter"){
        event.preventDefault()
        if (result[selectedIndex]){
          navigate("/asset?id=" + encodeURIComponent(result[selectedIndex].id))
        }
        else {
          onClickMore()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return ()=> window.removeEventListener("keydown", onKeyDown)
  }, [setSelectedIndex, maxIndex, selectedIndex, onClickMore, scrollActiveItemIntoView, navigate, result])

  return (
    <div className={style["quick-search-result"]} ref={resultRef} onMouseDown={e=> e.preventDefault()}>
      <div className={style['result-list']} ref={listRef}>
        {
          Object.keys(
            Array.from({length: 1000})).map((_, index)=> {
              return index < result.length && 
              <QuickSearchItem 
                key={index}
                itemRef={(div: HTMLDivElement)=> { elements[index] = div}} 
                selected={selectedIndex === index} 
                onClickItem={onClickItem} 
                {...result[index]}/>
            })
        }
      </div>
      {
        // selectedIndex
      }
      <div>
        {
          estimatedTotalHits === 0 ? <p>未找到结果。</p> :
          estimatedTotalHits > 1000 ? <p>找到了超过1000个结果。<a onClick={onClickMore}>更多...</a></p> :
          <p>找到了约{estimatedTotalHits}个结果。<a onClick={onClickMore}>查看...</a></p>
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

function QuickSearchItem(props: ArchiveItem & 
  { onClickItem: Function, matches: Matches, selected?: boolean, itemRef: any }) {
  const {type, id, matches, selected} = props
  const navigate = useNavigate()
  const hashToString = useHashToString()

  return (
    <div
      ref={props.itemRef}
      style={{
        textOverflow: "ellipsis", 
        whiteSpace: "nowrap", 
        overflow: "hidden",
        backgroundColor: selected ? "#e0d7ff70" : undefined, 
      }}
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
        (type === "shader") ?
          <MatchText text={props.file} match={matches["file"]}/> :
        (type === "bank") ? 
          <MatchText text={hashToString(props.bank)}/> :
        (type === "fmodevent") ? 
          <MatchText text={props.path} match={matches["path"]}/> :
        (type === "fmodproject") ?
          <MatchText text={props.file} match={matches["file"]}/> :
        (type === "entry") ?
          <MatchText text={props.plain_alias} match={matches["plain_alias"]}/> :
        <></>
      }
    </div>
  )
}
