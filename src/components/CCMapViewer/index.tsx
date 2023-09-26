import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLuaCallOnce } from '../../hooks'
import * as PIXI from 'pixi.js'
import shader from '../CCMiniPlayground/shader'

interface IProps {
  file: string,
}

const COLOR_BLOCK_STYLE: React.CSSProperties = {
  width: 100,
  height: 100,
}

export default function CCMapViewer(props: IProps) {
  const {file} = props
  const [url, setURL] = useState("")
  const [imgdata, setImgData] = useState<ImageData>()
  const [offset, setOffset] = useState<[number, number]>([0,0])
  
  const onMoveMove = useCallback((e: React.MouseEvent)=> {
    const target: HTMLImageElement = e.target as any
    const {clientX: px, clientY: py} = e
    const bbox = (target as HTMLImageElement).getBoundingClientRect()
    const offsetX = px - bbox.left
    const offsetY = py - bbox.top
    // console.log(offsetX, offsetY)
    setOffset([offsetX, offsetY]) // 0,0 -> 1023,31
  }, [])

  const dest = useMemo(()=> {
    const [x, y] = offset // 0-1023  0-31
    const to256 = n=> Math.round(n/31*255)
    const g = y
    const r = (x % 32)
    const b = Math.floor(x / 32)

    return [
      to256(r),
      to256(g),
      to256(b)
    ]
  }, [offset])

  const getPixel = useCallback((x, y)=> {
    if (!imgdata) return ["/"]
    const offset = (y*1024+x)*4
    const rgb = imgdata.data.slice(offset, offset + 3)
    return rgb
  }, [imgdata])

  useLuaCallOnce<number[]>("load", result=> {
    console.log(file)
    const array = Uint8Array.from(result)
    const blob = new Blob([array])
    const url = URL.createObjectURL(blob)
    createImageBitmap(blob).then(
      img=> {
        const ctx: CanvasRenderingContext2D = canvas.current.getContext("2d")
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, 1024, 32)
        setImgData(data)
      }
    )
    setURL(url)
    
  }, {type: "texture", file, format: "png"}, [file])

  const ref = useRef()
  const canvas = useRef()
  const blockRef = useRef()
  const appRef = useRef()

  useEffect(()=> {
    if (!ref.current)return
    if (!url) return
    if (blockRef.current){
      blockRef.current.forEach((r,i)=> {

        r.beginFill(`rgb(${dest.join(",")})`);
        r.drawRect(i*100, 0, 50, 50);
      })
      // blockRef.current.drawImage(document.getElementById("img"), 0, 0)
      return 
    }
    const app = new PIXI.Application({width: 1000, height: 300})
    ref.current.innerHTML = ""
    ref.current.appendChild(app.view)

    let obj = new PIXI.Graphics();
    obj.beginFill(`rgb(${dest.join(",")})`);
    obj.drawRect(0, 0, 50, 50);
    app.stage.addChild(obj)
    appRef.current = app
    
    let obj2 = new PIXI.Graphics();
    app.stage.addChild(obj2)
    obj2.filters = []

    blockRef.current = [obj, obj2]

    // let tex = PIXI.Texture.from(document.getElementById("img"))
    let bg = PIXI.Sprite.from('http://10.7.203.90:8000/cc.png', {mipmap: PIXI.MIPMAP_MODES.OFF, scaleMode: PIXI.SCALE_MODES.NEAREST})
    bg.width = 1024*1.5
    bg.height = 32*1.5
    bg.y = 50
    app.stage.addChild(bg)

    let bg2 = PIXI.Sprite.from('http://10.7.203.90:8000/cc.png')
    bg2.width = 1024*1.5
    bg2.height = 32*1.5
    bg2.x = 0
    bg2.y = 50+33
    app.stage.addChild(bg2)

    
    console.log('>>>>', PIXI.Texture.from(url))
    let filter = new PIXI.Filter(null, shader, {percent: 1, uCCTexture: PIXI.Texture.from(url, {mipmap: PIXI.MIPMAP_MODES.OFF})})
    obj.filters = [filter]
    
    bg.filters = [filter]

  }, [dest, url])

  useEffect(()=> {
    let timer = setInterval(()=> {
      console.log("----")
      const c = ref.current.getElementsByTagName("canvas")
      console.log(c)
    }, 33)
    return clearInterval(timer)
  }, [])

  const [url2, setURL2] = useState("")

  const onClick = useCallback(()=> {
    return
    const ctx: WebGL2RenderingContext = (appRef.current.renderer.context.gl)
    const buf = new Uint8Array(4)
    ctx.readPixels(0,0,1,1,ctx.RGBA, ctx.UNSIGNED_BYTE, buf)
    // console.log(buf)
    console.log(appRef.current.view)
    const url = (appRef.current.view.toDataURL("image/png"))
    setURL2(url)
    createImageBitmap(url).then(
      img=> {
        console.log(img)
        const canvas = document.getElementById("233")
        canvas.getContext("2d").drawImage(img, 0, 0)
      }
    )

  }, [])

  return (
    <div onClick={onClick}>
      <img src={url} onMouseMove={onMoveMove}/>
      <p>{offset[0]}, {offset[1]}</p>
      <p>初始颜色</p>
      <div style={{backgroundColor: `rgb(${dest.join(",")})`, ...COLOR_BLOCK_STYLE}}/>
      <p>目标颜色 (CPU)</p>
      {
        dest.join(", ")
      }
      <p>目标颜色 (GLSL)</p>
      <div ref={ref}></div>
      <img src={url2} />
      <canvas width={10} height={10} id="233"/>
      <p>取色器</p>
      {
        (getPixel(...offset).join(", "))
      }
      {/* <canvas width={1024} height={32} ref={canvas} style={{opacity: 0}}/> */}
      <img id="img" src={"http://10.7.203.90:8000/loading_feast.tex.png"} style={{zoom: "10%"}} />
    </div>
  )
}
