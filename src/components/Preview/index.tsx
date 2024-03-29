/**
 * a simple preview widget that rendered only when into view
 * need a static width and height
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppSetting, useIntersectionObserver, useLuaCall, useLuaCallOnce } from '../../hooks'
import { Button, Dialog, Icon, IconName, Spinner, Tag } from '@blueprintjs/core'
import { appWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api'
import store, { useSelector } from '../../redux/store'
import { base64DecToArr } from '../../base64_util'
import { EntryPreviewData } from '../../searchengine'
import { AnimState } from '../AnimCore_Canvas/animstate'
import AnimCore from '../AnimCore_Canvas'
import { RenderParams } from '../AnimCore_Canvas/renderparams'
import { useQuickLookCmds } from '../AnimQuickLook/util'

interface PreviewProps {
  width?: number,
  height?: number,
  lazy?: boolean,
}

function useCanvasPreviewSetup(
  props: PreviewProps, 
  [defaultWidth, defaultHeight]: [number, number])
{
  const {width = defaultWidth, height = defaultHeight} = props
  const ref = useRef<HTMLDivElement>()
  const canvas = useRef<HTMLCanvasElement>()
  const appeared = useIntersectionObserver({ref}).appeared || props.lazy === false
  const [resolution] = useAppSetting("resolution")

  const pix = window.devicePixelRatio * (resolution === "half" ? 0.5 : 1.0)
  const renderWidth = pix* width
  const renderHeight = pix* height
  const loadingSize = Math.min(width, height)* 0.5

  return {
    ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize
  }
}

function drawOnCenter(canvas: HTMLCanvasElement, renderSize: [number, number], bitmap: ImageBitmap) {
  const [renderWidth, renderHeight] = renderSize
  const {width: w, height: h} = bitmap
  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, renderWidth, renderHeight)
  const x_scale = renderWidth / w
  const y_scale = renderHeight / h
  if (x_scale < y_scale){
    ctx.drawImage(bitmap, 0, (renderHeight - h * x_scale)/2, renderWidth, h* x_scale)
  }
  else{
    ctx.drawImage(bitmap, (renderWidth - w* y_scale)/2, 0, w* y_scale, renderHeight)
  }
}

enum LoadingState {
  Loading,
  Success,
  Failed,
}

function Loading(props: {size: number, loadingState: LoadingState}) {
  const {size, loadingState} = props
  return (
    <>
      <div className="center">
        {
          loadingState === LoadingState.Loading && 
          <Spinner size={size} />
        }
      </div>
      <div className="center" style={{width: "80%", textAlign: "center"}}>
        {
          loadingState === LoadingState.Failed && 
          <div style={{color: "red"}}>
            <span>加载失败</span>
          </div>
        }
      </div>
    </>
  )
}

const PREIVEW_STYLE: React.CSSProperties = {
  minWidth: 1,
  minHeight: 1,
  position: "relative"
}

interface ImageProps extends PreviewProps {
  xml: string,
  tex: string,
}

function Image(props: ImageProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [80, 80])
  const [loadingState, setState] = useState(LoadingState.Loading)
  const {xml, tex} = props

  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        setState(LoadingState.Success)
      }
      catch(e){
        setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
  }, {type: "image", format: "png", rw: renderWidth, rh: renderHeight, xml, tex},
  [xml, tex, width, height, appeared],
  [appeared])
  
  return <div ref={ref} style={PREIVEW_STYLE}>
    {
      appeared && <>
        <Loading size={loadingSize} loadingState={loadingState}/>
        <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
          {width, height}}/>
        <></>
      </>
    }
  </div>
}

/** image displayer with *.tex and list of possible *.xml, useful for inventoryimages */
function AutoImage(props: ImageProps & {xmlList: string[]}) {
  const {tex, xmlList} = props
  const xml = useMemo(()=> {
    console.log(tex, xmlList)
    for (let v of window.assets.alltexelement){
      if (v.tex === tex){
        if (xmlList.indexOf(v.xml) !== -1){
          return v.xml
        }
      }
    }
    return ""
  }, [tex, xmlList])
  return <Image {...props} xml={xml}/>
}

AutoImage.INVENTORYIMAGES = [
  "images/inventoryimages1.xml",
  "images/inventoryimages2.xml",
  "images/inventoryimages3.xml",
  "images/inventoryimages4.xml",
]

AutoImage.SCRAPBOOK = [
  "images/scrapbook_icons1.xml",
  "images/scrapbook_icons2.xml",
  "images/scrapbook_icons3.xml",
  "images/scrapbook_icons4.xml",
]

interface TextureProps extends PreviewProps {
  file: string,
}

function Texture(props: TextureProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [80, 80])
  const [loadingState, setState] = useState(LoadingState.Loading)
  const {file} = props

  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        setState(LoadingState.Success)
      }
      catch(e){
        setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
  }, {type: "texture", format: "png", rw: renderWidth, rh: renderHeight, file},
  [file, appeared], [appeared])

  return <div ref={ref} style={PREIVEW_STYLE}>
  {
    appeared && <>
      <Loading size={loadingSize} loadingState={loadingState}/>
      <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
        {width, height}}/>
    </>
  }
  </div>

}

type CCProps = PreviewProps & {
  cc: string,
  percent?: number,
  [K: string]: any, // generic image loader props
}

function CC(props: CCProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [80, 80])
  const [loadingState, setState] = useState(LoadingState.Loading)
  const {cc, percent} = props

  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        setState(LoadingState.Success)
      }
      catch(e){
        setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
  }, {...props, type: "image_with_cc", format: "png", rw: renderWidth, rh: renderHeight},
  [cc, percent, appeared], [appeared])

  return <div ref={ref} style={PREIVEW_STYLE}>
  {
    appeared && <>
      <Loading size={loadingSize} loadingState={loadingState}/>
      <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
        {width, height}}/>
    </>
  }
  </div>
}

interface XmlMapProps extends PreviewProps {
  file: string,
  texpath: string,
  _numtex: number,
}

function XmlMap(props: XmlMapProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [0, 0])
  const {texpath, file: xmlpath, _numtex = 1} = props
  const [loadingState, setState] = useState(LoadingState.Loading)

  const drawRect = useLuaCall<string>("load", (result, {x_scale, y_scale})=> {
    const data = JSON.parse(result)
    const ctx = canvas.current.getContext("2d")
    ctx.strokeStyle = "#6c5793"
    data.elements.forEach(({uv: [u1, u2, v1, v2]})=> {
      if (Math.max(u2-u1, v2-v1) < .1) return
      const ratio = x_scale / y_scale
      if (ratio > 1)
        ctx.strokeRect(u1* renderWidth/ratio, (1-v2)* renderHeight, (u2-u1)* renderWidth/ratio, (v2-v1)* renderHeight)
      else
        ctx.strokeRect(u1* renderWidth, (1-v2)* renderHeight*ratio, (u2-u1)* renderWidth, (v2-v1)* renderHeight*ratio)
    })
  }, {type: "xml", file: xmlpath}, [xmlpath])

  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        const {width: w, height: h} = bitmap

        const ctx = canvas.current.getContext("2d")
        ctx.clearRect(0, 0, renderWidth, renderHeight)
        const x_scale = renderWidth / w
        const y_scale = renderHeight / h
        if (x_scale < y_scale){
          ctx.drawImage(bitmap, 0, 0, renderWidth, h* x_scale)
        }
        else{
          ctx.drawImage(bitmap, 0, 0, w* y_scale, renderHeight)
        }
        drawRect({x_scale, y_scale})
        setState(LoadingState.Success)
      }
      catch(e){
        setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
  }, {type: "texture", file: texpath, format: "png", rw: renderHeight, rh: renderHeight},
  [texpath, appeared, xmlpath],
  [appeared])

  const tagScale = _numtex >= 100 ? 0.8 : 1
  return <div ref={ref} style={PREIVEW_STYLE}>
    {
      appeared && <>
      <Loading size={loadingSize} loadingState={loadingState}/>
      <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
        {width, height}}/>
      <Tag intent="primary" interactive
        style={{position: "absolute", right: 0, top: 0, transform: "translate(50%, -50%) scale(" + tagScale +")"}}
        onClick={(e)=> [e.stopPropagation(), appWindow.emit("quick_settings", "XmlMap.dot")]}
      >
        {_numtex}
      </Tag>
      </>
    }

  </div>
  
}

interface AtlasProps extends PreviewProps {
  build: string,
  sampler: number,
  onCreateImageBitmap?: (bitmap: ImageBitmap)=> void
}

function Atlas(props: AtlasProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [100, 100])
  const [loadingState, setState] = useState(LoadingState.Loading)
  const {build, sampler} = props

  useLuaCallOnce<string>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(base64DecToArr(result))
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        if (props.onCreateImageBitmap) {
          props.onCreateImageBitmap(bitmap)
        }
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        setState(LoadingState.Success)
      }
      catch(e){
        setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
      
  }, {type: "atlas", format: "png_base64", /*rw: renderWidth, rh: renderHeight, */build, sampler},
  [build, sampler, width, height, appeared],
  [appeared])
  
  return <div ref={ref} style={PREIVEW_STYLE}>
    {
      appeared && <>
        <Loading size={loadingSize} loadingState={loadingState}/>
        <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
          {width, height}}/>
      </>
    }
  </div>
}

const int = (v: number)=> Math.max(Math.round(v), 0) 

interface FastSymbolElementProps extends PreviewProps {
  atlas: any,
  data: any,
}

function FastSymbolElement(props: FastSymbolElementProps) {
  const {ref, canvas, /*appeared,*/ renderWidth, renderHeight} = useCanvasPreviewSetup(props, [50, 50])
  const {atlas, data} = props
  const {width, height} = props
  const {bbx, bby, cw, ch, w, h, sampler} = data
  const bitmap = atlas[sampler]

  useEffect(()=> {
    if (!bitmap) return

    const W = bitmap.width
    const H = bitmap.height
    const x_scale = W/cw
    const y_scale = H/ch
  
    const ctx = canvas.current.getContext("2d")
    ctx.clearRect(0, 0, renderWidth, renderHeight)

    if (w > h) {
      ctx.drawImage(bitmap, 
        int(bbx * x_scale), int(bby * y_scale), 
        int(w * x_scale), int(h * y_scale), 
        0, int(renderHeight* (1-h/w)/2), 
        renderWidth, int(renderWidth* h/w))
    }
    else {
      ctx.drawImage(bitmap, 
        int(bbx * x_scale), int(bby * y_scale), 
        int(w * x_scale), int(h * y_scale), 
        int(renderWidth* (1-w/h)/2), 0, 
        int(renderHeight*w/h), renderHeight)
    }

  }, [bitmap, data, canvas, bbx, bby, cw, ch, w, h, sampler, renderWidth, renderHeight])

  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
    <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
      {width, height}
    }/>
  </div>
}

type SymbolElementProps = {
  build: string,
  symbol: string,
  index: number,
} & PreviewProps

function SymbolElement(props: SymbolElementProps){
  const {ref, canvas, appeared, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [50, 50])
  const {build, symbol, index} = props
  const {width, height} = props
  
  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        // setState(LoadingState.Success)
      }
      catch(e){
        // setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
  }, {type: "symbol_element", build, imgname: symbol, index, format: "png"},
  [build, symbol, index], [appeared])

  return (
    <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
      <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
        {width, height}
      }/>
    </div>
  )
}

function Zip(props: {file: string} & PreviewProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [0, 0])
  const [loadingState, setState] = useState(LoadingState.Loading)
  const {file} = props
  const [idList, setList] = useState<Array<"auto"|"swap_icon"|number>>(["auto"])
  const [idIndex, setIndex] = useState(0)
  const isPureAnimation = idList.length === 0

  useLuaCallOnce<string>("load", (result)=> {
    const list: Array<"swap_icon"|number> = JSON.parse(result)
    setList(list)
    if (list.length === 0)
      setState(LoadingState.Success)
    if (list.indexOf("swap_icon") !== -1)
      setIndex(list.indexOf("swap_icon"))
  }, {type: "atlas_preview", file, id: "list"},
  [file, appeared],
  [appeared])

  useLuaCallOnce<number[]>("load", (result)=> {
    async function load(){
      try {
        //@ts-ignore
        if (result.length === 0) return
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)

        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        setState(LoadingState.Success)
      }
      catch(e){
        setState(LoadingState.Failed)
        console.error(e)
      }
    }
    load()
  }, {type: "atlas_preview", file, id: idList[idIndex], rw: renderWidth, rh: renderHeight},
  [file, idList, idIndex, appeared, isPureAnimation],
  [appeared && !isPureAnimation])

  if (isPureAnimation) {
    return (
      <SimpleIcon icon="walk" ref={ref}/>
    )
  }
  else {
    return (
      <div ref={ref} style={PREIVEW_STYLE}>
        <Loading size={loadingSize} loadingState={loadingState}/>
        <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
          {width, height}
        }/>
        {
          idList.length > 1 && 
          <Button 
            // minimal
            intent="primary"
            icon="refresh"
            small
            style={{position: "absolute", right: 0, top: 0, transform: "translate(50%, -50%) scale(0.8)"}}
            onClick={(e: React.MouseEvent)=> {
              e.stopPropagation()
              setIndex(i=> i + 1 === idList.length ? 0 : i + 1)
            }}>
          </Button>
        }
        {
          isPureAnimation && 
          <div style={{position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}>
            <Icon icon="walk" style={{color: "#aaa"}} size={30}/>
          </div>
        }
      </div>
    )
  }
}

function EntryAnim(props: EntryPreviewData["anim"] & PreviewProps & {
  forcePercent?: number, isPlaying?: boolean, autoScale?: boolean, fixedScale?: number, onInitAnimState?: (animstate: AnimState)=> void}) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [80, 80])
  // const [loadingState, setState] = useState(LoadingState.Loading)
  const {bank, build, anim, animpercent, facing, alpha, overridebuild, overridesymbol, hidesymbol, hide} = props
  const {forcePercent, isPlaying, autoScale = true, fixedScale} = props
  const animstate = useRef(new AnimState()).current

  const apiList = useQuickLookCmds({bank, build, animation: anim}, true)
  
  // convert preview data to animstate api list
  useEffect(()=> {
    const list = [
      {name: "SetBank", args: [bank]},
      {name: "SetBuild", args: [build]},
      {name: "PlayAnimation", args: [anim]},
      overridebuild && {name: "OverrideBuild", args: [overridebuild]},
      alpha && {name: "SetMultColour", args: [1,1,1,alpha]},
      ...(hide || []).map(v=> ({name: "Hide", args: [v]})),
      ...(hidesymbol || []).map(v=> ({name: "HideSymbol", args: [v]})),

      ...apiList,
    ]
    if (Array.isArray(overridesymbol)){
      overridesymbol.forEach((v)=> {
        list.push({name: "OverrideSymbol", args: [...v] as any})
        if (typeof v[3] === "number")
          list.push({name: "SetSymbolMultColour", args: [v[0], 1, 1, 1, v[3]] as any})
      })
    }
    animstate.clear()
    animstate.thumbnailMode = true
    animstate.autoFacingByBit = true
    // @ts-ignore
    animstate.setApiList(list.filter(Boolean))
    animstate.pause()
    animstate.getPlayer().setPercent(forcePercent || animpercent || 0)
    animstate.facing = facing
  }, [bank, build, anim, animpercent, forcePercent, facing, 
    hide, hidesymbol, alpha, overridebuild, overridesymbol, 
    animstate, apiList])

  const {onInitAnimState} = props
  useEffect(()=> {
    onInitAnimState?.(animstate)
  }, [animstate, onInitAnimState])

  const [render, setRender] = useState<RenderParams>()

  useEffect(()=> {
    const onChangeRect = ()=> {
      if (fixedScale) {
        if (render){
          render.centerStyle = "center"
          render.scale = fixedScale
        }
        return
      }
      if (!autoScale) return
      const {left, top, width: w, height: h} = animstate.rect
      const scaleW = width / w, scaleH = height / h
      const scale = Math.min(scaleW, scaleH)
      if (render) {
        render.centerStyle = "origin"
        if (scaleW > scaleH){
          render.applyPlacement({
            x: -left*scale + (width - w*scale)/2,
            y: -top*scale,
            scale,
          })
        }
        else {
          render.applyPlacement({
            x: -left*scale,
            y: -top*scale + (height - h*scale)/2,
            scale,
          })
        }
      }
    }
    animstate.addEventListener("changerect", onChangeRect)
    return ()=> animstate.removeEventListener("changerect", onChangeRect)
  }, [animstate, width, height, render, autoScale, fixedScale])

  useEffect(()=> {
    if (typeof isPlaying !== "boolean") return
    if (isPlaying)
      animstate.resume()
    else
      animstate.pause()
  }, [animstate, isPlaying])

  return (
    <>
      <div 
        ref={ref} 
        style={{width, height}}
      >
        {
          appeared && <>
            <AnimCore 
              width={width} 
              height={height} 
              noMouseEvent
              bgc="transparent"
              animstate={animstate}
              renderRef={v=> setRender(v)}
            />
          </>
        }
      </div>
    </>
  )
}

const SFX_ID = "PREVIEW_SFX"
function Sfx(props: {path: string, param_list: any[]} & PreviewProps) {
  const {path} = props
  const isPlaying = useSelector(({appstates})=> 
    (appstates.fmod_playing_info[SFX_ID] || {}).playing)
  const playingPath = useSelector(({appstates})=> 
    (appstates.fmod_playing_info[SFX_ID] || {}).path)
  const play = useCallback(()=> {
    // don't use `useSelector` for performance issue
    const param_value = store.getState().localstorage.fmod_param_value
    const params = Object.fromEntries(
      props.param_list.map(({name, range})=> {
        const percent = param_value[name] || 0
        return [name, range[0] + (range[1]-range[0])*percent]
      })
    )
    invoke("fmod_send_message", {data: JSON.stringify({
      api: "PlaySoundWithParams",
      args: [path, SFX_ID, params],
    })})
  }, [path, props.param_list])
  const stop = useCallback(()=> {
    invoke("fmod_send_message", {data: JSON.stringify({
      api: "KillSound",
      args: [SFX_ID],
    })})
  }, [])
  const onClick = useCallback((e: React.MouseEvent)=> {
    if (isPlaying) {
      stop()
      if (playingPath !== path) {
        play()
      }
    }
    else {
      play()
    }
    e.stopPropagation()
  }, [play, stop, isPlaying, playingPath, path])

  return (
    <div style={{position: "relative", width: "100%", height: "100%"}}>
      <Button icon="music" large 
        intent={isPlaying && playingPath === path ? 
          "primary" : "none"}
        onClick={onClick}
        style={{position: "absolute", transform: "translate(-50%, -50%)", left: "50%", top: "50%"}}/>
    </div>
  )
}

export function killPreviewSfx() {
  invoke("fmod_send_message", {data: JSON.stringify({
    api: "KillSound",
    args: [SFX_ID],
  })})
}

export function SimpleIcon({icon, ref}: {icon: IconName, ref?: React.RefObject<HTMLDivElement>}) {
  return (
    <div ref={ref} className="relative w-full h-full">
      <Button 
        minimal
        large
        icon={icon}
        className={`absolute left-1/2 top-1/2 
          transform -translate-x-1/2 -translate-y-1/2 scale-120`}
      />
  </div>
  )
}

export default {
  Image,
  AutoImage,
  Texture,
  CC,
  XmlMap,
  Atlas,
  Zip,
  EntryAnim,
  FastSymbolElement,
  SymbolElement,
  SimpleIcon,
  Sfx,
} as const