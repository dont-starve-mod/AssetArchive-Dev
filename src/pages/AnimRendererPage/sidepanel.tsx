import React, { useCallback, useState } from 'react'
import style from './sidepanel.module.css'
import { useMouseDrag } from '../../hooks'
import ControlPanel from '../../components/ControlPanel'

interface IProps {
  width: number,
  onChangeWidth: (width: number)=> void
}
const MIN_WIDTH = 200
export default function SidePanel(props: IProps) {
  const {width, onChangeWidth} = props
  const onMoveDivider = useCallback((_x: number, _y: number, px: number)=> {
    onChangeWidth(Math.max(MIN_WIDTH, px))
  }, [])
  const [onMouseDown] = useMouseDrag(onMoveDivider)

  return (
    <div style={{position: "relative"}}>
      <div className={style["side-panel"]} style={{width}}>
        <div className={style["divider"]} 
          style={{width: 4, left: width - 2}}
          onMouseDown={onMouseDown}
        />
        <div className={style["control-panel-container"]}>
          <ControlPanel.ApiPanel/>
          <ControlPanel.ApiPanel/>
        </div>

      </div>
    </div>
  )
}
