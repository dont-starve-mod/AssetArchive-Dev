import { Alignment, H5, Menu, MenuDivider, NavbarDivider, Slider, Switch } from '@blueprintjs/core'
import * as PIXI from 'pixi.js'
import { MIPMAP_MODES, SCALE_MODES } from 'pixi.js'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import shader from './shader'

interface IProps {
  cc: string,
}

interface AppUniforms {
  percent: number,
}

export default function CCMiniPlayground(props: IProps) {
  const {cc} = props

  const [percent, SetPercent] = useState(100)
  const [enabled, setEnabled] = useState(true)
  const shaderPercent = enabled ? percent / 100 : 0
  const ref = useRef<HTMLDivElement>()
  const appUniforms = useRef<AppUniforms>({percent: 1.0}).current

  useEffect(()=> {
    appUniforms.percent = shaderPercent
  }, [shaderPercent])

  useEffect(()=> {
    if (ref.current) {
      ref.current.innerHTML = ""

      const app = new PIXI.Application({width: 625, height: 285}) // TODO: 分辨率?
      ref.current.appendChild(app.view as any)

      const img = PIXI.Sprite.from("https://pic.imgdb.cn/item/6510184ec458853aef81aff4.png") //  TODO: 图片来源？

      img.width = app.screen.width
      img.height = app.screen.height
      app.stage.addChild(img)

      let filter = new PIXI.Filter(null, shader, {
          percent: 0.0,
          uCCTexture: PIXI.Texture.from(cc, {mipmap: MIPMAP_MODES.OFF, scaleMode: SCALE_MODES.LINEAR}),
      })
      img.filters = [filter]

      app.ticker.add(() => {
        filter.uniforms.percent = appUniforms.percent
      })

      return ()=> app.destroy()
    }
  }, [cc])

  return (
    <div key={cc} style={{userSelect: "none", WebkitUserSelect: "none"}}>
      <H5>滤镜预览</H5>
      {/* <p>这是一个<a onClick={()=> alert("还没写完")}>色彩映射滤镜</a>，你可以感受一下它的风格。</p> */}
      <div style={{width: 70, userSelect: "none", display: "flex"}}>
        <Switch 
          style={{marginRight: 0, transform: "translateY(-4px)"}}
          checked={enabled} onChange={(e)=> 
            //@ts-ignore
            setEnabled(e.target.checked)}/>
        <NavbarDivider style={{marginRight: 20}}/>
        <Slider 
          min={0} max={100} 
          labelStepSize={100} 
          disabled={!enabled}
          value={percent} onChange={v=> SetPercent(v)}/>
      </div>
      <div ref={ref} style={{zoom: "45%"}}/>
    </div>
  )
}