import React, { useRef, useCallback, useState, useEffect } from 'react'
import { addAnimState, removeCanvas, CanvasRenderer } from './animcore'
import { useAppSetting, useMouseDrag, useMouseScroll } from '../../hooks'
import { IRenderParams } from './renderparams'
import { v4 } from 'uuid'
import { AnimState } from './animstate'

type AnimCoreProps = {
  width?: number,
  height?: number,
  bgc?: string,
  animstate: AnimState,
  customLoaders?: object,
  noMouseEvent?: boolean,
  renderRef?: (render: any)=> void
}

const dummy = ()=> {}

export default function AnimCore(props: AnimCoreProps & IRenderParams) {
  const {width = 540, height = 300, bgc = "#aaa", animstate, customLoaders} = props
  const canvas = useRef<CanvasRenderer>()
  const [resolution] = useAppSetting("resolution")

  const onMouseMove = useCallback((x: number, y: number)=> {
    canvas.current?.render.offset(x, y)
  }, [])
  const onMouseScroll = useCallback((y: number)=> {
    canvas.current?.render.scroll(y)
  }, [])
  const [onMouseDown] = useMouseDrag(onMouseMove)
  const [onWheel, onMouseEnter, onMouseLeave] = useMouseScroll(onMouseScroll)
  const {renderRef} = props
  const onRef = useCallback((ref: CanvasRenderer)=> {
    if (ref){
      addAnimState(ref, animstate, customLoaders, props)
      ref.logicalSize = { width, height }
      canvas.current = ref
      if (renderRef) renderRef(ref.render)
    }
    else{
      removeCanvas(ref)
      if (renderRef) renderRef(null)
    }
  }, [renderRef, width, height, animstate, customLoaders, props])

  const canvasStyle = {
    width, height,
  }

  const [filterId] = useState(()=> v4())
  const [colorMatrix, setColorMatrix] = useState("")

  useEffect(()=> {
    const onTint = ()=> {
      const {mult, add} = animstate.getPreviewTint()
      const colorMatrix = [
        mult[0], 0, 0, 0, add[0]* add[3],
        0, mult[1], 0, 0, add[1]* add[3],
        0, 0, mult[2], 0, add[2]* add[3],
        0, 0, 0, mult[3], 0,
      ].join(" ")
      setColorMatrix(colorMatrix)     
    }
    onTint()
    animstate.addEventListener("rebuildtint", onTint)
    return ()=> animstate.removeEventListener("rebuildtint", onTint)
  }, [animstate])

  const {noMouseEvent} = props

  return (
    <div style={{...canvasStyle, backgroundColor: bgc, position: "relative"}}>
      <svg height="0" className="absolute">
        <filter id={filterId}>
          <feColorMatrix values={colorMatrix}/>
          {/* <feColorMatrix values={colorMatrix} style={{colorInterpolationFilters:"sRGB"}}/> */}
        </filter>
      </svg>
      <canvas 
        ref={onRef} 
        width={width* window.devicePixelRatio} 
        height={height* window.devicePixelRatio} 
        style={{...canvasStyle, position: "absolute", filter: `url(#${filterId})`}}
        onMouseDown={!noMouseEvent ? onMouseDown : dummy}
        onWheel={!noMouseEvent ? onWheel : dummy}
        onMouseEnter={!noMouseEvent ? onMouseEnter : dummy}
        onMouseLeave={!noMouseEvent ? onMouseLeave : dummy}
      />
    </div>
  )
}
