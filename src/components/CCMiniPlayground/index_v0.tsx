import { H5, NumericInput, Slider } from '@blueprintjs/core'
import * as PIXI from 'pixi.js'
import { ColorMapFilter } from '@pixi/filter-color-map'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLuaCall } from '../../hooks'
import shader from './shader'

interface IProps {
  cc: string,
}

function init(node: HTMLDivElement, cc: ImageBitmap){
  const app = new PIXI.Application({width: 400, height: 180});

  node.innerHTML = ""
  node.appendChild(app.view as any);

  // const container = new PIXI.Container()
  // app.stage.addChild(container)

  // Create background image
  const background = PIXI.Sprite.from('https://pic.imgdb.cn/item/650e5c4ac458853aefe76ea1.jpg');

  background.width = app.screen.width;
  background.height = app.screen.height;
  app.stage.addChild(background);
  // container.addChild(background)

  // Create the new filter, arguments: (vertexShader, framentSource)
  let filter = new PIXI.Filter(null, shader, {
      percent: 0.0,
      // uCCTexture: PIXI.Texture.from('https://pic.imgdb.cn/item/650e9cdbc458853aef05d3f7.png')
      uCCTexture: PIXI.Texture.from(cc),
  });

  app.stop()
  setTimeout(()=> app.start(), 1000)

  new ColorMapFilter(
    new ImageBitmap(),
    // PIXI.Texture.from('https://pic.imgdb.cn/item/650e9cdbc458853aef05d3f7.png'),
    false, 1.0)

  // Add the filter
  background.filters = [filter];

  // Animate the filter
  let time = 0
  app.ticker.add((dt) =>
  {
    time += dt * 0.025
    filter.uniforms.percent = 0.8;//0.5 + 0.5* Math.sin(time)
  });


}

interface PixiMiniApp {
  app: PIXI.Application,
  percent: number,
}

export default function CCMiniPlayground(props: IProps) {
  const {cc} = props

  const [bitmap, setBitmap] = useState<ImageBitmap>()
  const [percent, SetPercent] = useState(100)
  const [enabled, setEnabled] = useState(true)
  const app = useRef()

  const shaderPercent = enabled ? percent / 100 : 0

  const loadCC = useLuaCall<number[]>("load", result=> {
    async function load() {
      try {
        const array = Uint8Array.from(result)
        const blob = new Blob([array])
        const bitmap = await createImageBitmap(blob)
        setBitmap(bitmap)
        init(ref.current, bitmap)
      }
      catch(e){
        console.error(e)
      }
    }
    load()
  }, {type: "texture", file: cc, format: "png"}, [cc])

  const ref = useRef()

  useEffect(()=> {
    loadCC()
  }, [loadCC])

  // const onRef = useCallback((ref: HTMLDivElement)=> {
  //   if (!ref) return
  //   loadCC()
  //   init(ref)
  // }, [])

  return (
    <div key={cc}>
      <H5>滤镜预览</H5>
      <p>这是一个色彩映射滤镜。{cc}</p>
      <div style={{width: 50, userSelect: "none"}}>
        <Slider 
          min={0} max={100} 
          labelStepSize={100} 
          disabled
          value={percent} onChange={v=> SetPercent(v)}/>
      </div>
      <NumericInput/>
      {/* <div ref={onRef}/> */}
      <div ref={ref}/>
      {/* <img src={url}/> */}
    </div>
  )
}
