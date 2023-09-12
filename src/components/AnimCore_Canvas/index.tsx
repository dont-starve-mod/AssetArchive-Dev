import React, { useRef, useCallback } from 'react'
import { addAnimState, removeCanvas, CanvasRenderer } from './animcore'
import { useMouseDrag, useMouseScroll } from '../../hooks'
import { IRenderParams } from './renderparams'

interface IProps {
  width?: number,
  height?: number,
  bgc?: string,
  animstate: any,
  customLoaders?: object,
}

export default function AnimCore(props: IProps & IRenderParams) {
  const {width = 540, height = 300, bgc = "#aaa", animstate, customLoaders} = props
  const canvas = useRef<CanvasRenderer | null>(null)
  const onMouseMove = useCallback((x: number, y: number)=> {
    canvas.current?.render.offset(x, y)
  }, [])
  const onMouseScroll = useCallback((y: number)=> {
    canvas.current?.render.scroll(y)
  }, [])
  const [onMouseDown] = useMouseDrag(onMouseMove)
  const [onWheel, onMouseEnter, onMouseLeave] = useMouseScroll(onMouseScroll)

  const onRef = useCallback((ref: CanvasRenderer)=> {
    if (ref){
      addAnimState(ref, animstate, customLoaders, props)
      ref.logicalSize = { width, height }
      canvas.current = ref
    }
    else{
      removeCanvas(ref)
    }
  }, [])

  const canvasStyle = {
    width, height,
  }
  
  return (
    <div style={{...canvasStyle, backgroundColor: bgc, position: "relative"}}>
      <canvas ref={onRef} 
        width={width* window.devicePixelRatio} 
        height={height* window.devicePixelRatio} 
        style={{...canvasStyle, position: "absolute"}}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </div>
  )
}
