/**
 * a simple preview widget that rendered only when into view
 * need a static width and height
 */
import React, { useEffect, useRef, useState } from 'react'
import { useIntersectionObserver, useLuaCall, useLuaCallOnce } from '../../hooks'
import { Button, Dialog, Icon, Spinner, Tag } from '@blueprintjs/core'
import { appWindow } from '@tauri-apps/api/window'

interface PreviewProps {
  width: number,
  height: number,
}

function useCanvasPreviewSetup(
  props: {width: number, height: number, lazy?: boolean}, 
  [defaultWidth, defaultHeight]: [number, number])
{
  const {width = defaultWidth, height = defaultHeight} = props
  const ref = useRef<HTMLDivElement>()
  const canvas = useRef<HTMLCanvasElement>()
  const appeared = useIntersectionObserver({ref}).appeared || props.lazy === false

  const pix = window.devicePixelRatio * (window.config.resolution === "half" ? 0.5 : 1.0)
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

interface CCProps extends PreviewProps {
  cc: string,
  percent?: number,
  [K: string]: any, // generic image loader props
}

function CC(props: CCProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight, loadingSize} = useCanvasPreviewSetup(props, [80, 80])
  const [loadingState, setState] = useState(LoadingState.Loading)
  const {cc, percent} = props
  console.log(111)

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

  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
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
      
  }, {type: "atlas", format: "png", /*rw: renderWidth, rh: renderHeight, */build, sampler},
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

interface SymbolElementProps extends PreviewProps {
  atlas: any,
  data: any,
}

function SymbolElement(props: SymbolElementProps) {
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

  }, [bitmap, data, canvas.current])

  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
    <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
      {width, height}
    }/>
  </div>
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

  return <div ref={ref} style={PREIVEW_STYLE}>
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
}

export default {
  Image,
  Texture,
  CC,
  XmlMap,
  Atlas,
  Zip,
  SymbolElement,
}