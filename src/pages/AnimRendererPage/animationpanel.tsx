import React from 'react'
import style from './animation.module.css'

interface IProps {
  left: number,

}
export default function AnimationPanel(props: IProps) {
  const {left} = props
  return (
    <div className={style["animation-panel"]} style={{left, width: `calc(100vw - ${left}px)`}}>
      Animation
    </div>
  )
}
