import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import style from './index.module.css'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { Button } from '@blueprintjs/core'
import { useMouseDrag } from '../../hooks'
import { useQuickLookExport } from '../AnimQuickLook/util'

type MiniAnimPlayerWidgetProps = {
  animstate: AnimState,
  width?: number,
}

export default function MiniAnimPlayerWidget(props: MiniAnimPlayerWidgetProps) {
  const {animstate, width = 160} = props
  const [_, forceUpdate] = useReducer(v=> v + 1, 0)
  const player = useMemo(()=> animstate.getPlayer(), [animstate])
  const percent = player.getSmoothPercent()

  useEffect(()=> {
    let timer = setInterval(()=> {
      forceUpdate()
    }, 33)
    return ()=> clearInterval(timer)
  }, [forceUpdate])

  const barRef = useRef<HTMLDivElement>()
  const updateBarPercent = useCallback((px: number, _py: number)=> {
    if (barRef.current) {
      const rect = barRef.current.getBoundingClientRect()
      const percent = px < rect.left ? 0 : px > rect.right ? 1 :
        (px - rect.left) / rect.width
      player.setPercent(percent)
      forceUpdate()
    }
  }, [player, forceUpdate])

  const onMoveCb = useCallback((_x: number, _y:  number, px: number, py: number)=> {
    if (barRef.current){
      updateBarPercent(px, py)
    }
  }, [updateBarPercent])

  const [onMouseDown] = useMouseDrag(onMoveCb)
  const onMouseDown2 = useCallback((e: React.MouseEvent<HTMLDivElement>)=> {
    if (barRef.current){
      updateBarPercent(e.clientX, e.clientY)
    }
    onMouseDown()
  }, [onMouseDown, updateBarPercent])

  const exportFn = useQuickLookExport(animstate)

  return (
    <div className={style["box"]} style={{width}}>
      <div className={style["control-group"]}>
        <Button icon="step-backward" small minimal 
          onClick={()=> [player.step(-1), animstate.pause(), forceUpdate()]}/>
        <Button icon={animstate.isPaused ? "play" : "pause"} small minimal
          onClick={()=> [animstate.isPaused ? animstate.resume() : animstate.pause(), forceUpdate()]}/>
        <Button icon="step-forward" small minimal
          onClick={()=> [player.step(1), animstate.pause(), forceUpdate()]}/>
      </div>
      <div className={style["control-group-right"]}>
        <Button icon="camera" small minimal
          onClick={()=> exportFn("snapshot")}
        />
      </div>
      <div className={style["bar"]} style={{width: width - 10, left: 5, bottom: 5}} ref={barRef}>
        <div className={style["bar-region"]} style={{width: width - 6}} onMouseDown={onMouseDown2}/>
      </div>
      <div className={style["handle"]} style={{bottom: 5-3, left: (width - 12) * percent + 4}}></div>
    </div>
  )
}
