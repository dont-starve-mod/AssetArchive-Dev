import { H5, NavbarDivider, Slider, Switch } from '@blueprintjs/core'
import * as PIXI from 'pixi.js'
import { MIPMAP_MODES, SCALE_MODES } from 'pixi.js'
import React, { useEffect, useRef, useState } from 'react'
import shader from './shader'
import sample_img from "./sample_image.jpg"

type CCMiniPlaygroundProps = {
  cc: string,
}

type AppUniforms = {
  percent: number,
}

export default function CCMiniPlayground(props: CCMiniPlaygroundProps) {
  const {cc} = props

  const [percent, SetPercent] = useState(100)
  const [enabled, setEnabled] = useState(true)
  const shaderPercent = enabled ? percent / 100 : 0
  const ref = useRef<HTMLDivElement>()
  const appUniforms = useRef<AppUniforms>({percent: 1.0})

  useEffect(()=> {
    appUniforms.current.percent = shaderPercent
  }, [shaderPercent])

  useEffect(()=> {
    if (ref.current) {
      async function mount(){
        const tex = await PIXI.Texture.fromURL(sample_img)
        const img = new PIXI.Sprite(tex)
        const {width, height} = img      
        
        const app = new PIXI.Application({width: width / 4, height: height / 4})
        app.view.style.width = "100%"
        ref.current.innerHTML = ""
        ref.current.appendChild(app.view as any)
  
        img.width = app.screen.width
        img.height = app.screen.height
        app.stage.addChild(img)
  
        let filter = new PIXI.Filter(null, shader, {
            percent: 0.0,
            uCCTexture: PIXI.Texture.from(cc, {mipmap: MIPMAP_MODES.OFF, scaleMode: SCALE_MODES.LINEAR}),
        })
        img.filters = [filter]
  
        app.ticker.add(() => {
          filter.uniforms.percent = appUniforms.current.percent
        })

        return app
      }

      const app = mount()
      const div = ref.current
      return ()=> {
        app.then(app=> app.destroy())
        div.innerHTML = ""
      }
    }
  }, [cc])

  return (
    <div key={cc} style={{userSelect: "none", WebkitUserSelect: "none"}}>
      <H5>滤镜预览</H5>
      <div style={{width: 70, userSelect: "none", display: "flex"}}>
        <Switch 
          style={{marginRight: 0, transform: "translateY(-4px)"}}
          checked={enabled} 
          //@ts-ignore
          onChange={(e)=> setEnabled(e.target.checked)}/>
        <NavbarDivider style={{marginRight: 20}}/>
        <Slider 
          min={0} max={100} 
          labelStepSize={100} 
          disabled={!enabled}
          value={percent} onChange={v=> SetPercent(v)}/>
      </div>
      <div ref={ref} style={{maxWidth: 800}}/>
    </div>
  )
}