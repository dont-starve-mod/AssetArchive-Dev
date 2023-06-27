import React, { useEffect, useRef, useState } from 'react'
import { useIntersectionObserver, useLuaCall } from '../../hooks'
import { Spinner } from '@blueprintjs/core'
/**
 * a simple preview widget that rendered only when into view
 * need a static width and height
 */
export default function Preview(props) {
  return <></>
}

function useCanvasPreviewSetup(props, [defaultWidth, defaultHeight]) {
  const {width = defaultWidth, height = defaultHeight} = props
  const ref = useRef()
  const canvas = useRef()
  const appeared = useIntersectionObserver({ref}).appeared || props.lazy === false

  const pix = window.devicePixelRatio * (window.config.resolution === "half" ? 0.5 : 1.0)
  const renderWidth = pix* width
  const renderHeight = pix* height

  return {
    ref, canvas, appeared, width, height, renderWidth, renderHeight
  }
}

function Image(props) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [80, 80])
  const [loadingState, setState] = useState(1)

  const call = useLuaCall("load", result=> {
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
          ctx.drawImage(bitmap, 0, (renderHeight - h * x_scale)/2, renderWidth, h* x_scale)
        }
        else{
          ctx.drawImage(bitmap, (renderWidth - w* y_scale)/2, 0, w* y_scale, renderHeight)
        }
        setState(0)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
      
  }, {type: "image", format: "png", rw: renderWidth, rh: renderHeight, 
    xml: props.xml, tex: props.tex}, [props.xml, props.tex, width, height])
  
  useEffect(()=> {
    if (appeared) call()
  }, [appeared, call])
  
  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
    {
      appeared && <>
        { loadingState === 1 && <Spinner size={Math.min(width, height)* 0.5}/> }
        { loadingState === -1 && <p style={{color: red}}>加载失败</p> }
        <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
          {width, height}}/>
        <></>
      </>
    }
  </div>
}

function Atlas(props) {
  const {ref, canvas, appeared, width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [100, 100])
  const [loadingState, setState] = useState(1)

  const call = useLuaCall("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        const {width: w, height: h} = bitmap
        if (props.onCreateImageBitmap) {
          props.onCreateImageBitmap(bitmap)
        }

        const ctx = canvas.current.getContext("2d")
        ctx.clearRect(0, 0, renderWidth, renderHeight)
        const x_scale = renderWidth / w
        const y_scale = renderHeight / h
        if (x_scale < y_scale){
          ctx.drawImage(bitmap, 0, (renderHeight - h * x_scale)/2, renderWidth, h* x_scale)
        }
        else{
          ctx.drawImage(bitmap, (renderWidth - w* y_scale)/2, 0, w* y_scale, renderHeight)
        }
        setState(0)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
      
  }, {type: "atlas", format: "png", /*rw: renderWidth, rh: renderHeight, */
    build: props.build, sampler: props.sampler}, [props.build, props.sampler, width, height])
  
  useEffect(()=> {
    if (appeared) call()
  }, [appeared, call])
  
  return <div ref={ref} style={{minWidth: 1, minHeight: 1}}>
    {
      appeared && <>
        { loadingState === 1 && <Spinner size={Math.min(width, height)* 0.5}/> }
        { loadingState === -1 && <p style={{color: red}}>加载失败</p> }
        <canvas ref={canvas} width={renderWidth} height={renderHeight} style={
          {width, height}}/>
        <></>
      </>
    }
  </div>
}

const int = v=> Math.max(Math.round(v), 0) 

function SymbolElement(props) {
  const {ref, canvas, /*appeared,*/ width, height, renderWidth, renderHeight} = useCanvasPreviewSetup(props, [50, 50])
  const {atlas, data} = props
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


Preview.Image = Image
Preview.Atlas = Atlas
Preview.SymbolElement = SymbolElement


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