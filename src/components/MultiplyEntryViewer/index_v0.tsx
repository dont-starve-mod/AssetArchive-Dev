// similar with EntrySearcher component
// view content of `scripts/fx.lua`

import { Button, Callout, Card, Checkbox, Dialog, DialogBody, H3, H5, H6, Radio, RadioGroup, Tag, TagProps } from '@blueprintjs/core'
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocalStorage, usePagingHandler } from '../../hooks'
import InputGroup from '../InputGroup'
import { Entry, MultEntry } from '../../searchengine'
import Preview from '../Preview'
import { sortedAlias } from '../AliasTitle'
import Background from '../Background'
import { Tooltip2 } from '@blueprintjs/popover2'
import { search } from '../../global_meilisearch'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { invoke } from '@tauri-apps/api/core'
import PageTurner from '../PageTurner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import smallhash from '../../smallhash'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import AnimQuickLook from '../AnimQuickLook'
import PopoverMenu from '../PopoverMenu'
import { useQuickLookExport } from '../AnimQuickLook/util'
import { byte2facing } from '../../facing'
const appWindow = getCurrentWebviewWindow()

type MultiplyEntryViewerProps = {
  entryList: ()=> Entry[],
  isFx?: true,
}

export default function MultiplyEntryViewer(props: MultiplyEntryViewerProps) {
  const [_, forceUpdate] = useReducer(v => v + 1, 0)

  /* eslint-disable react-hooks/exhaustive-deps */
  const all = props.entryList().filter(v=> v.type === "entry") || []
  const assetLoaded = all.length > 0

  useEffect(()=> {
    let timer = setInterval(()=> {
      if (!assetLoaded) forceUpdate()
    }, 500)
    return ()=> clearInterval(timer)
  }, [assetLoaded, forceUpdate])

  const [selected, setSelected] = useLocalStorage("fx_filter_selected")

  const [query, setQuery] = useState("")
  const hasQuery = query.trim() !== ""
  const [queryResult, setQueryResult] = useState<{[id: string]: true}>({})
  useEffect(()=> {
    if (!hasQuery) return
    search("assets", query, {
      limit: 100,
      filter: "type = entry"
    }).then(result=> {
      if (result.query === query){
        setQueryResult(Object.fromEntries(result.hits.map((v)=> [v.id, true])))
      }
    })
  }, [query])

  const {isFx} = props
  const items = useMemo(()=> {
    let items = all
    if (isFx && selected["filter-sfx"]){
      items = items.filter(v=> v.preview_data && v.preview_data.sound)
    }
    if (hasQuery){
      items = items.filter(v=> queryResult[v.id])
    }
    return items
  }, [all, selected, isFx, queryResult, hasQuery])

  const handler = usePagingHandler(items, {
    numItemsPerPage: 80,
    resetScroll: ()=> document.getElementById("app-article").scrollTop = 1
  })

  const {range} = handler

  return (
    <div>
      <div style={{display: "flex", alignContent: "center", marginBottom: 5}}>
        <InputGroup
          placeholder= "筛选"
          leftIcon="filter"
          small
          style={{maxWidth: 200}}
          onChange2={setQuery}
        />
        <Checkbox className="ml-3"
          checked={selected["autoplay"]}
          onChange={(v)=> setSelected({...selected, autoplay: v.currentTarget.checked})}
        >
          自动播放
          <Tooltip2 content="开启自动播放可能会影响性能">
            <Button minimal intent="danger" small icon="info-sign" className="align-middle"/>
          </Tooltip2>
        </Checkbox>
        {
          isFx &&
          <>
            <Checkbox className="ml-2"
              checked={selected["filter-sfx"]}
              onChange={(v)=> setSelected({...selected, "filter-sfx": v.currentTarget.checked})}
            >包含音效</Checkbox>
            <Checkbox className="ml-2"
              checked={selected["muted"]}
              onChange={(v)=> setSelected({...selected, muted: v.currentTarget.checked})}
            >静音</Checkbox>
          </>
        }
      </div>
      <div>
        <Tag minimal>特效总数 {all.length}</Tag>
        <Tag minimal className="m-1">当前显示 {items.length}</Tag>
      </div>
      <div className="flex flex-wrap justify-between">
        {
          items.map(({id, alias, preview_data}, i)=> 
            i >= range[0] && i <= range[1] &&
            <PreviewCard key={id} 
              preview={preview_data} alias={alias} autoPlay={selected["autoplay"]} 
              onClick={()=> appWindow.emit("open_fx_detail", {id, alias, preview_data})}
              />
            )
        }
        {
          Array.from({length: 10}).map((_, i)=> 
            <div key={i} className="flex-1 m-1" 
              style={{minWidth: 200, padding: 5}}>
            </div>)
        }
      </div>
      <PageTurner {...handler} style={{marginBottom: 40}}/>
      <FxDetail/>
    </div>
  )
}

const SFX_ID = "PREVIEW_SFX"

function PreviewCard(props: {preview: Entry["preview_data"], alias: string[], autoPlay?: boolean, onClick?: ()=> void}) {
  const [hover, setHover] = useState(false)
  const [selected, setSelected] = useLocalStorage("fx_filter_selected")
  const [showPopover, setShowPopover] = useState(false)
  const muted = selected["muted"]
  const animRef = useRef<AnimState>(null)
  const navigate = useNavigate()

  const {preview, onClick} = props

//   invoke("fmod_send_message", {data: JSON.stringify({
//     api: "PlaySoundWithParams",
//     args: [path, SFX_ID, params],
//   })})
// }, [path, props.param_list])
// const stop = useCallback(()=> {
//   invoke("fmod_send_message", {data: JSON.stringify({
//     api: "KillSound",
//     args: [SFX_ID],
//   })})
// }, [])

  useEffect(()=> {
    if (muted || !preview.sound || !hover) return
    const cb = ()=> {
      if (animRef.current && animRef.current.currentFrame === 0) {
        invoke("fmod_send_message", {data: JSON.stringify({
          api: "PlaySound",
          args: [preview.sound, SFX_ID],
        })}).then(
          console.log, console.error
        )
      }
    }
    if (animRef.current) {
      animRef.current.addEventListener("onupdate", cb)
    }
    return ()=> {
      animRef.current?.removeEventListener("onupdate", cb)
    }
  }, [hover, preview.sound, muted])

  return (
    <Card 
      className="cursor-pointer m-1 flex-1"
      interactive
      style={{minWidth: 200, height: 90, padding: 5}}
      onClick={onClick}
      onMouseEnter={()=> setHover(true)}
      onMouseLeave={()=> setHover(false)}
    >
      <div className="relative">
        <div className="flex">
          <Background 
            className="flex-shrink-0"
            backgroundStyle="solid" 
            backgroundColor="#aaa"
            width={80} height={80}>
            <Preview.EntryAnim 
              {...preview.anim}
              forcePercent={0.5}
              isPlaying={props.autoPlay || hover}
              onInitAnimState={anim=> {
                animRef.current = anim
                // anim.DEV_usingElementLoader = false
              }}
              width={80} 
              height={80}
            />
          </Background>
          <div>
            <H6 className="break-all flex-shrink" style={{margin: 4}}>
              {sortedAlias(props.alias)[0]}
            </H6>
          </div>
        </div>
        <div className="absolute right-0 bottom-0">
          {/* <Button icon="export" minimal/> */}
          {
            preview.sound &&
            <Tooltip2 
              isOpen={showPopover}
              onInteraction={v=> setShowPopover(v)}
              content={<>
              <p>该动画特效包含音效：</p>
              <p>{preview.sound}</p>
            </>}>
              <Button icon="music" minimal small style={{
                opacity: muted ? 0.5 : 1,
              }} onClick={(e: React.MouseEvent)=> {
                e.preventDefault()
                e.stopPropagation()
                setShowPopover(false)
                navigate("/asset?id=f-"+smallhash(preview.sound))
              }}/>
            </Tooltip2>
          }
        </div>
      </div>
    </Card>
  )
}

const FilterTag = (props: TagProps & {filterKey: string})=> {
  const {filterKey} = props
  const [selected, setSelected] = useLocalStorage("fx_filter_selected")
  return <Tag {...props} 
    minimal={selected[filterKey] ? false : true}
    interactive 
    className="m-1 shrink-0"
    intent={selected[filterKey] ? "primary" : "none"}
  />
}

function FxDetail() {
  const [entry, setEntry] = useState<Entry>()
  const isOpen = Boolean(entry && entry.id)
  const [param] = useSearchParams()
  const id = param.get("id") || ""

  useEffect(()=> {
    let unlisten = appWindow.listen<Entry>("open_fx_detail", ({payload})=> {
      setEntry(payload)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    if (!id.startsWith("e-"))
      setEntry(undefined)
  }, [id])

  const anim = entry && entry.preview_data && entry.preview_data.anim
  const [animstate, setAnim] = useState<AnimState>()
  const [facingList, setFacingList] = useState<number[]>([])
  const closeDialog = ()=> setEntry(undefined)

  const exportFn = useQuickLookExport(animstate, entry?.alias[0])

  useEffect(()=> {
    if (animstate){
      setTimeout(()=> {
        setFacingList(animstate.facingList)
      }, 200)
    }
  }, [animstate])

  return (
    <Dialog 
      isOpen={isOpen} onClose={closeDialog}
      title=""
      style={{width: 600, height: 450}}
      >
      <DialogBody>
        <div className="flex items-center h-full">
          <div style={{width: 240, height: 240}}>
            {
              anim && <AnimQuickLook
                bankhash={smallhash(anim.bank)}
                build={anim.build}
                animation={anim.anim}
                animstateRef={setAnim}
                // facing={anim.facing}
                width={240}
                maxAspectRatio={1.2}
                minAspectRatio={1}
                noCog
              />
            }
          </div>
          <div style={{width: 300, height: "90%", overflow: "auto", marginLeft: 10}}>
            {
              isOpen && <>
                <H3>{entry.alias[0]}</H3>
                <H6 className="mt-2">基本信息</H6>
                <Card className="m-1 p-2">
                  <table>
                    <tr>
                      <td><Tag minimal>材质</Tag></td>
                      <td>{anim.build}</td>
                    </tr>
                    <tr>
                      <td><Tag minimal>动画库</Tag></td>
                      <td>{anim.bank}</td>
                    </tr>
                    <tr>
                      <td><Tag minimal>动画</Tag></td>
                      <td>{anim.anim}</td>
                    </tr>
                    <tr>
                      <td><Tag minimal>音效</Tag></td>
                      <td style={{wordBreak: "break-all"}}>
                        {
                          entry.preview_data.sound ?
                            <PopoverMenu menu={[
                              {icon: "link", text: "查看详情", 
                                directURL: `/asset?id=f-${smallhash(entry.preview_data.sound)}`}
                            ]}>
                              {entry.preview_data.sound}
                            </PopoverMenu> :
                            <>-</>
                        }
                      </td>
                    </tr>
                  </table>
                </Card>
                {/* <H6 className="mt-4">切换朝向</H6>
                <RadioGroup>
                  {
                    facingList.map(v=> 
                      <Radio key={v} label={byte2facing(v)}
                        onChange={()=> {}}/>)
                  }
                </RadioGroup> */}
                <H6 className="mt-3">快速导出</H6>
                <Button icon="image-rotate-right" onClick={()=> exportFn("gif").then(()=> closeDialog())}>动图/gif</Button>
                <Button icon="video" onClick={()=> exportFn("mp4").then(()=> closeDialog())}>视频/mp4</Button>
                <Button icon="video" onClick={()=> exportFn("mov").then(()=> closeDialog())}>无损视频/mov</Button>
                <Button icon="widget" onClick={()=> exportFn("snapshot").then(()=> closeDialog())}>当前帧截图/png</Button>
                <p style={{marginTop: 10, color: "#aaa", cursor: "pointer"}} onClick={()=> window.alert("TODO:")}>
                  在<b>「动画渲染器」</b>中可定制更多动画效果。
                </p>
              </>
            }

          </div>

        </div>
      </DialogBody>
    </Dialog>
  )
}

const getFx = ()=>  
  Object.values(window.assets_tag["#fx"] || {}) as Entry[]
const getMainScreen = ()=>
  Object.values(window.assets_tag["#main_screen"] || {}) as Entry[]

MultiplyEntryViewer.Fx = ()=> 
  <MultiplyEntryViewer entryList={getFx} isFx/>

// MultiplyEntryViewe