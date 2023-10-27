import React, { useCallback, useRef, useState } from 'react'
import type { XmlData } from '../../pages/AssetPage'
import style from './index.module.css'
import { useCopyTexElement, useGenericSaveFileCb, useIntersectionObserver, useMouseDrag, useMouseScroll, useSaveFileCall } from '../../hooks'
import { useMouseDragClick, useLuaCallOnce } from '../../hooks'
import { off } from 'process'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { useNavigate } from 'react-router-dom'
import { Button, Menu, MenuItem } from '@blueprintjs/core'

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
  const [offset, setOffset] = useState([0, 0])
  const onDrag = useCallback((x: number, y: number)=> {
    setOffset(([px, py])=> [px + x, py + y])
  }, [])
  const [basicScale, setBasicScale] = useState(0)
  const [scale, setScale] = useState(1)
  const onScroll = useCallback((v: number, e: React.WheelEvent)=> {
    const newScale = Math.min(Math.max(scale * Math.pow(.99, v*0.5), 0.2), 8.0)
    const delta = newScale - scale
    setScale(newScale)
    const {clientX, clientY} = e
    const {x, y} = imgRef.current.getBoundingClientRect()
    setOffset(offset=> [offset[0]+(x-clientX-offset[0])*delta*basicScale, offset[1]+(y-clientY-offset[1])*delta*basicScale])
    // TODO: fix this
  }, [scale])
  const [onMouseDown] = useMouseDrag(onDrag)
  const [onWheel, onMouseEnter, onMouseLeave] = useMouseScroll(onScroll)
  const [imgSize, setImgSize] = useState([0, 0])
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
          setOffset([PADDING, (boxHeight - h * x_scale)* 0.5])
        }
        else{
          setBasicScale(y_scale)
          setOffset([(boxWidth - w * y_scale)* 0.5, PADDING])
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
    setScale(1)
    const [w, h] = imgSize
    const {width: boxWidth, height: boxHeight} = boxRef.current.getBoundingClientRect()
    const x_scale = (boxWidth - 2*PADDING) / w
    const y_scale = (boxHeight - 2*PADDING) / h
    if (x_scale < y_scale){
      setOffset([PADDING, (boxHeight - h * x_scale)* 0.5])
    }
    else{
      setOffset([(boxWidth - w * y_scale)* 0.5, PADDING])
    }
  }, [imgSize])

  const renderWidth = imgSize[0]* basicScale * scale
  const renderHeight = imgSize[1]* basicScale * scale
  const [hoveredInfo, setHoveredInfo] = useState<ElementInfo>()

  const [onElementDown, onElementUp, isElementDragClick] = useMouseDragClick()
  const [selectedInfo, setSelected] = useState<ElementInfo>()

  const info = hoveredInfo || selectedInfo

  const copy = useCopyTexElement(xml, null)
  const download = useSaveFileCall({
    type: "image", xml,
  }, "image", "image.png", [xml])

  return (
    <div>
      <hr/>
      <div style={{minHeight: 70}}>
        <p>
          <strong>元素:&nbsp;</strong>
          {
            info ? `${info.name} (${info.width}x${info.height})` : "未选择"
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
            style={{position: "absolute", left: offset[0], top: offset[1], outline: "4px solid green"}}
              width={renderWidth}
              height={renderHeight}
              />
          <div className={style["uv-box-container"]}>
            {
              data.elements.map(({uv: [u1, u2, v1, v2], width, height, name, id}, index)=> {
                const selectedStyle: React.CSSProperties = selectedInfo && selectedInfo.id === id ? {
                  borderColor: "#f00",
                  borderWidth: 2,
                  zIndex: 1,
                } : {}
                return (
                  <div key={index} className={style["uv-box"]} style={{
                    left: offset[0] + Math.floor(u1* renderWidth),
                    top: offset[1] + Math.floor((1-v2)* renderHeight),
                    width: width* basicScale* scale + 1,
                    height: height* basicScale* scale + 1,    
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
        </div>
      </div>
    </div>
  )
}
