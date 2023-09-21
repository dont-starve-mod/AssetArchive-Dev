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

  return {
    ref, canvas, appeared, width, height, renderWidth, renderHeight
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

interface ImageProps extends PreviewProps {
  xml: string,
  tex: string,
}

function Image(props: ImageProps) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [80, 80])
  const [loadingState, setState] = useState(1)
  const {xml, tex} = props

  const call = useLuaCall<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        setState(0)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
  }, {type: "image", format: "png", rw: renderWidth, rh: renderHeight, xml, tex},
  [xml, tex, width, height])
  
  useEffect(()=> {
    if (appeared) call()
  }, [appeared, call])
  
  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
    {
      appeared && <>
        { loadingState === 1 && <Spinner size={Math.min(width, height)* 0.5}/> }
        { loadingState === -1 && <p style={{color: "red"}}>加载失败</p> }
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
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [80, 80])
  // const [loadingState, setState] = useState(1)
  const {file} = props
  const loadingState = 0

  useLuaCallOnce<number[]>("load", result=> {
    if (!appeared) return
    async function load(){
      try {
        console.log(result)
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        // setState(0)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
  }, {type: "texture", format: "png", rw: renderWidth, rh: renderHeight, file},
  [file, appeared])

  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
  {
    appeared && <>
      { loadingState === 1 && <Spinner size={Math.min(width, height)* 0.5}/> }
      { loadingState === -1 && <p style={{color: "red"}}>加载失败</p> }
      <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
        {width, height}}/>
      <></>
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
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [0, 0])
  const {texpath, file: xmlpath, _numtex = 1} = props
  const [loadingState, setState] = useState(1)

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
    if (!appeared || !canvas.current) return

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
        setState(0)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
  }, {type: "texture", file: texpath, format: "png", rw: renderHeight, rh: renderHeight},
  [texpath, appeared, xmlpath])

  const tagScale = _numtex >= 100 ? 0.8 : 1
  return <div ref={ref} style={{minWidth: 1, minHeight: 1, position: "relative"}}>
    {
      appeared && <>
      { loadingState === 1 && <Spinner size={Math.min(width, height)* 0.5}/> }
      { loadingState === -1 && <p style={{color: "red"}}>加载失败</p> }
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
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [100, 100])
  const [loadingState, setState] = useState(1)
  const {build, sampler} = props

  useLuaCallOnce<number[]>("load", result=> {
    if (!appeared) return
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        const {width: w, height: h} = bitmap
        if (props.onCreateImageBitmap) {
          props.onCreateImageBitmap(bitmap)
        }
        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
        // const ctx = canvas.current.getContext("2d")
        // ctx.clearRect(0, 0, renderWidth, renderHeight)
        // const x_scale = renderWidth / w
        // const y_scale = renderHeight / h
        // if (x_scale < y_scale){
        //   ctx.drawImage(bitmap, 0, (renderHeight - h * x_scale)/2, renderWidth, h* x_scale)
        // }
        // else{
        //   ctx.drawImage(bitmap, (renderWidth - w* y_scale)/2, 0, w* y_scale, renderHeight)
        // }
        setState(0)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
      
  }, {type: "atlas", format: "png", /*rw: renderWidth, rh: renderHeight, */build, sampler},
  [build, sampler, width, height, appeared])
  
  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
    {
      appeared && <>
        { loadingState === 1 && <Spinner size={Math.min(width, height)* 0.5}/> }
        { loadingState === -1 && <p style={{color: "red"}}>加载失败</p> }
        <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
          {width, height}}/>
        <></>
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
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [0, 0])
  const {file} = props
  const [idList, setList] = useState<Array<"auto"|"swap_icon"|number>>(["auto"])
  const [idIndex, setIndex] = useState(0)
  const isPureAnimation = idList.length === 0

  useLuaCallOnce<string>("load", (result)=> {
    const list: Array<"swap_icon"|number> = JSON.parse(result)
    setList(list)
    console.log(list)
    if (list.indexOf("swap_icon") !== -1){
      setIndex(list.indexOf("swap_icon"))
    }
  }, {type: "atlas_preview", file, id: "list"}, [file])

  useLuaCallOnce<number[]>("load", (result)=> {
    if (!appeared) return
    if (isPureAnimation) return

    async function load(){
      try {
        //@ts-ignore
        if (result.length === 0) return
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)

        drawOnCenter(canvas.current, [renderWidth, renderHeight], bitmap)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
  }, {type: "atlas_preview", file, id: idList[idIndex], rw: renderWidth, rh: renderHeight},
  [file, idList, idIndex, appeared, isPureAnimation])

  return <div ref={ref} style={{minWidth: 1, minHeight: 1, position: "relative"}}>
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
  XmlMap,
  Atlas,
  Zip,
  SymbolElement,
}

// function EntryPreview(props){
//   return 
// }

// const URL_FMT = {
//   tex: (props)=> {
//     const {xmlpath, imgname, resW, resH} = props
//     return "/api/load/image_rgba/?" + 
//       `xml=${encodeURIComponent(xmlpath)}&tex=${encodeURIComponent(imgname)}&res=${resW}x${resH}`
//   },
//   xml: (props)=> {
//     const {file: xmlpath, resW, resH} = props
//     return "/api/load/tex_rgba/?" + 
//       `xml=${encodeURIComponent(xmlpath)}&res=${resW}x${resH}`
//   },
//   dyn: (props)=> {
//     const {file, resW, resH} = props
//     const match = file.match(/([\w]+)\.dyn$/)
//     const build = match[1]
//     const resParam = `res=${resW}x${resH}`
//     // 注意这里直接请求了skinname而不是文件路径，可能会有点点问题 （假设有文件名和skinname不对应的情况xD）
//     return [
//       "/api/load/swap_icon_rgba/" + encodeURIComponent(build) + "?" + resParam,
//       "/api/load/atlas_rgba/" + encodeURIComponent(build) + "?" + resParam,
//     ]
//   },
// }

// function ImagePreview(props){
//   const {file: imgname, xmlpath, texpath} = props
//   const resW = props.width* window.devicePixelRatio
//   const resH = props.height* window.devicePixelRatio
//   const canvas = useRef()
//   const [failed, setFailed] = useState(false)
//   useEffect(()=> {
//     // 注意这个请求会有1分钟左右的缓存行为
//     let url = (URL_FMT[props.type])({...props, resW, resH, 
//       imgname: props.type === "img" ? imgname : null
//     })
//     if (typeof url === "string") url = [url] // 转换为字符串
//     async function load(){
//       try{
//         for (let i = 0; i < url.length + 1 /* 索引+1强制触发错误 */; ++i){
//           if (url[i] === undefined) throw Error("All url(s) failed.") // <- 越界
        
//           const response = await axios.get(url[i], {responseType: "blob"})
//           const {headers: {width, height, compress}, data} = response
//           if (width === "-1") continue
//           let buffer = await data.arrayBuffer()
//           if (compress !== undefined){
//             let [raw, len] = compress.split(":").map(i=> parseInt(i))
//             if (len !== buffer.byteLength){
//               console.warn(`Compressed buffer length not match: ${len} vs ${buffer.length}`)
//               continue
//             }
//             buffer = pako.inflate(buffer)
//             if (raw !== buffer.byteLength){
//               console.warn(`Raw buffer length not match: ${raw} vs ${buffer.length}`)
//               // try load anyway
//             }
//           }
//           const img = new ImageData(new Uint8ClampedArray(buffer), width, height)
//           const bitmap = await createImageBitmap(img)
          
//           const ctx = canvas.current.getContext("2d")
//           ctx.clearRect(0, 0, resW, resH)
//           /* 保持原始比例 */
//           const x_scale = resW / width
//           const y_scale = resH / height
//           if (x_scale < y_scale){
//             ctx.drawImage(bitmap, 0, (resH - height * x_scale)/2, resW, height* x_scale)
//           }
//           else{
//             ctx.drawImage(bitmap, (resW - width* y_scale)/2, 0, width* y_scale, resH)
//           }
//           break; // 不尝试剩余的api链接
//         }
//       }
//       catch(e){
//         console.warn("无法加载图片: ", props)
//         console.warn(e.message)
//         setFailed(true)
//       }
//     }
//     load()
//   }, [imgname, xmlpath, texpath])

//   return <div className='basic-box' style={{position: "relative"}}>
//     <canvas width={resW} height={resH} ref={canvas} style={{width: props.width, height: props.height}} />
//     <div style={{position: "absolute", left: 0, top: 0}} >
//       {
//         failed && <span style={{color: "#f00"}}>加载失败</span>
//       }
//     </div>
//   </div>
// }

// function DynPreview(props){
//   return <ImagePreview {...props}/>
// }

// function XmlPreview(props){
//   // return 233
//   return <ImagePreview {...props}/>
// }