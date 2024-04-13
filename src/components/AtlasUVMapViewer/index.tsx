import React, { useCallback, useRef, useState } from 'react'
import type { XmlData } from '../../pages/AssetPage'
import style from './index.module.css'
import { useCopyTexElement, useIntersectionObserver, useLocalStorage, useMouseDrag, useMouseScroll, useSaveFileCall } from '../../hooks'
import { useMouseDragClick, useLuaCallOnce } from '../../hooks'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, Switch } from '@blueprintjs/core'

interface BuildAtlasProps {

}

interface ImageAtlasProps {
  xml: string,
  data: XmlData,
  texpath: string,
}

const transparentStyle: React.CSSProperties = {
  backgroundImage: "linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%), linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 8px 8px",
}

type ElementInfo = {
  id: string,
  name: string,
  width: number,
  height: number,
  uv: number[],
}

export default function AtlasUVMapViewer(props: ImageAtlasProps) {
  const boxRef = useRef<HTMLDivElement>()
  const imgRef = useRef<HTMLImageElement>()
  const appeared = useIntersectionObserver({ref: boxRef}).appeared
  const [error, setError] = useState("")
  // const [offset, setOffset] = useState([0, 0])
  const [imgSize, setImgSize] = useState([0, 0])
  const onDrag = useCallback((x: number, y: number)=> {
    setCanvasData(({x: px, y: py, scale})=> ({x: px + x, y: py + y, scale}))
    // setOffset(([px, py])=> [px + x, py + y])
  }, [])
  const [basicScale, setBasicScale] = useState(0)
  const [canvasData, setCanvasData] = useState({x: 0, y: 0, scale: 1})

  const onScroll = useCallback((v: number, e: React.WheelEvent)=> {
    const {scale} = canvasData
    const newScale = Math.min(Math.max(scale * Math.pow(.99, v*0.5), 0.2), 8.0)
    const offset = [canvasData.x, canvasData.y]
    const delta = newScale - scale
    const {clientX, clientY} = e
    console.log(scale, "-->", newScale, "Delta", delta)
    const {x, y} = boxRef.current.getBoundingClientRect()
    const relX = clientX - x, relY = clientY - y
    console.log("refOff", relX - offset[0],relY - offset[1])
    console.log("deltaOff", (relX - offset[0])*delta*basicScale, (relY - offset[1])*delta*basicScale)

    setCanvasData({
      // x: offset[0]-(relX-offset[0])*delta*basicScale,
      // y: offset[1]-(relX-offset[1])*delta*basicScale,
      ...canvasData,
      scale: newScale,
    })
    // setOffset([
    //   offset[0]-(relX-offset[0])*delta*basicScale,
    //   offset[1]-(relY-offset[1])*delta*basicScale
    // ])
    // TODO: fix this
  }, [canvasData, basicScale])

  const [onMouseDown] = useMouseDrag(onDrag)
  const [onWheel, onMouseEnter, onMouseLeave] = useMouseScroll(onScroll)
  const {texpath, data, xml} = props

  const PADDING = 8

  useLuaCallOnce<number[]>("load", result=> {
    async function load(){
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const url = URL.createObjectURL(blob)
        const bitmap = await createImageBitmap(blob)
        const {width: w, height: h} = bitmap
        setImgSize([w, h])
        imgRef.current.src = url

        const {width: boxWidth, height: boxHeight} = boxRef.current.getBoundingClientRect()
        const x_scale = (boxWidth - 2*PADDING) / w
        const y_scale = (boxHeight - 2*PADDING) / h
        if (x_scale < y_scale){
          setBasicScale(x_scale)
          setCanvasData({x: PADDING, y: (boxHeight - h * x_scale)* 0.5, scale: 1})
          // setOffset([PADDING, (boxHeight - h * x_scale)* 0.5])
        }
        else{
          setBasicScale(y_scale)
          setCanvasData({x: (boxWidth - w * y_scale) * 0.5, y: PADDING, scale: 1})
          // setOffset([(boxWidth - w * y_scale)* 0.5, PADDING])
        }
      }
      catch(e){
        setError((e.toString()))
        console.error(e)
      }
    }
    load()
  }, {type: "texture", file: texpath, format: "png"},
  [texpath, appeared],
  [appeared])

  const onClickReset = useCallback(()=> {
    const [w, h] = imgSize
    const {width: boxWidth, height: boxHeight} = boxRef.current.getBoundingClientRect()
    const x_scale = (boxWidth - 2*PADDING) / w
    const y_scale = (boxHeight - 2*PADDING) / h
    if (x_scale < y_scale){
      setCanvasData({x: PADDING, y: (boxHeight - h * x_scale)* 0.5, scale: 1})
      // setOffset([PADDING, (boxHeight - h * x_scale)* 0.5])
    }
    else{
      setCanvasData({x: (boxWidth - w * y_scale) * 0.5, y: PADDING, scale: 1})
      // setOffset([(boxWidth - w * y_scale)* 0.5, PADDING])
    }
    // setOffset([0,0])
  }, [imgSize])

  const renderWidth = imgSize[0]* basicScale * canvasData.scale
  const renderHeight = imgSize[1]* basicScale * canvasData.scale
  const [hoveredInfo, setHoveredInfo] = useState<ElementInfo>()

  const [onElementDown, onElementUp, isElementDragClick] = useMouseDragClick()
  const [selectedInfo, setSelected] = useState<ElementInfo>()

  const info = hoveredInfo || selectedInfo

  const copy = useCopyTexElement(xml, null)
  const download = useSaveFileCall({
    type: "image", xml,
  }, "image", "image.png", [xml])

  const [showUV, setShowUV] = useLocalStorage("atlas_view_show_uvbox")
  const [showBorder, setShowBorder] = useLocalStorage("atlas_view_show_border")

  return (
    <div>
      <hr/>
      <div style={{minHeight: 70}}>
        <p>
          <strong>元素:&nbsp;</strong>
          {
            info ? `${info.name} (${info.width}✕${info.height})` : "未选择"
          }
          {
            info && <div style={{display: "inline-block", paddingLeft: 5}}>
              <Button icon="duplicate" text="拷贝" onClick={()=> copy({tex: info.name})}/>&nbsp;
              <Button icon="download" text="下载" onClick={()=> download({tex: info.name, defaultPath: info.name})}/>
            </div>
          }
        </p>
        <p>
          <strong>切割框:&nbsp;</strong>
          {
            info ? `${info.uv.join(", ")}` : "未选择"
          }
        </p>
      </div>
      <div style={{display: "none"}}>
        <p>state.offset: {canvasData.x}, {canvasData.y}</p>
        <p>size: {renderWidth} x {renderHeight}</p>
        <p>state.scale: {canvasData.scale}</p>
        <p>state.gscale: {basicScale}</p>
        
      </div>
      <div className={style["box"]} ref={boxRef}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        >
        <div className={style["main"]} style={transparentStyle}>
          <div className={style["error"]}>
            {
              error && "加载失败:\n" + error
            }
          </div>
          <img 
            ref={imgRef} 
            draggable={false}
            style={{position: "absolute", left: canvasData.x, top: canvasData.y, outline: showBorder ? "4px solid green" : null}}
              width={renderWidth}
              height={renderHeight}
              />
          <div
            style={{position: "absolute", left: canvasData.x-2, top: canvasData.y-2,
              width: 4, height: 4, backgroundColor: "pink",
            }}/>
          <div className={style["uv-box-container"]}>
            {
              data.elements.map(({uv: [u1, u2, v1, v2], width, height, name, id}, index)=> {
                const selectedStyle: React.CSSProperties = selectedInfo && selectedInfo.id === id ? {
                  borderColor: "#f00",
                  borderWidth: 2,
                  zIndex: 1,
                } : {}
                const colorStyle = showUV ? undefined : { borderColor: "transparent" }
                return (
                  <div key={index} className={style["uv-box"]} style={{
                    left: canvasData.x + Math.floor(u1* renderWidth),
                    top:  canvasData.y + Math.floor((1-v2)* renderHeight),
                    width: width* basicScale* canvasData.scale + 1,
                    height: height* basicScale* canvasData.scale + 1,
                    ...colorStyle, 
                    ...selectedStyle,
                         
                  }}
                    onMouseEnter={()=> {
                      setHoveredInfo({id, name, width, height, uv: [u1, u2, v1, v2]})
                    }}
                    onMouseLeave={()=> {
                      setHoveredInfo(undefined)
                    }}
                    onMouseDown={onElementDown}
                    onMouseUp={onElementUp}
                    onClick={()=>!isElementDragClick() && setSelected(
                      (selectedInfo && selectedInfo.id) !== id ? {id, name, width, height, uv: [u1, u2, v1, v2]} : undefined)}
                  >
                  </div>
                )
              })
            }
          </div>
        </div>
        <div style={{position: "absolute", right: 5, top: 5, width: 30, height: 30}}>
          <Tooltip2 content={"重置视图"}>
            <Button icon="reset" onClick={onClickReset}/>
          </Tooltip2>
          <div style={{height: 4}}></div>
          <Popover2 
            content={<div 
              style={{
                userSelect: "none", WebkitUserSelect: "none",
                backgroundColor: "white", padding: 10, paddingBottom:4, borderRadius: 2}}>
              <Switch label='切割框' 
                checked={showUV} 
                onChange={e=> setShowUV(e.currentTarget.checked)}></Switch>
              <Switch label='外框' 
                checked={showBorder} 
                onChange={e=> setShowBorder(e.currentTarget.checked)}></Switch>
            </div>}
            minimal
            placement="left">
            <Button icon="cog"/>
          </Popover2>
        </div>
      </div>
    </div>
  )
}
