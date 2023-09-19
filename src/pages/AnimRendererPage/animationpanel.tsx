import React from 'react'
import style from './animation.module.css'
import { Select2, Suggest2 } from '@blueprintjs/select'
interface IProps {
  left: number,

}
export default function AnimationPanel(props: IProps) {
  const {left} = props
  return (
    <div className={style["animation-panel"]} style={{left, width: `calc(100vw - ${left}px)`}}>
      Animation233

    </div>
  )
}

function Item(props) {
  // console.log(props, typeof props, props.onClick)
  return <p onClick={props.onClick}>{JSON.stringify(props)}</p>
}