import React from 'react'
import style from './index.module.css'
import { Slider, SliderProps } from '@blueprintjs/core'

export default function TinySlider(props: SliderProps & { width?: number }) {
  return (
    <div className={style["slider-container"]} style={{width: props.width}}>
      <Slider
        {...props}
        labelValues={[]}
        />
    </div>
  )
}