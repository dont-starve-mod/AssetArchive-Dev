import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import style from './animation.module.css'
import * as PIXI from 'pixi.js'
import { Select2, Suggest2 } from '@blueprintjs/select'
import animstateContext from './globalanimstate'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import { RenderParams } from '../../components/AnimCore_Canvas/renderparams'
import { tint } from './sprite_shader'
import { Button, ButtonGroup, H6, InputGroup, Radio, RadioGroup } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { appWindow } from '@tauri-apps/api/window'
import { useMouseDrag, useMouseScroll } from '../../hooks'
import AnimPlayerWidget from '../../components/AnimPlayerWidget'

const int = (i: number)=> Math.round(i)

const getImgIndex = (imgList: any[], index: number)=> {
  if (imgList.length === 1) return 0
  let i = 0, j = imgList.length - 1
  if (imgList[j].index < index) return j
  while (1){
    if (imgList[i].index === index) return i
    if (imgList[j].index === index) return j
    let k = Math.floor((i+j)/2)
    if (i === k) return i
    if (imgList[k].index === index) return k
    else if (imgList[k].index > index) j = k
    else i = k
  }
}

interface IProps {
  left: number,
}

/** Don't Starve anim player based on pixi.js */
export default function AnimationPanel(props: IProps) {
  const {animstate, render} = useContext(animstateContext)
  const [currentApp, setApp] = useState<PIXI.Application>()
  const ref = useRef<HTMLDivElement>()

  const createFilter = useCallback(()=> {
    return new PIXI.Filter(null, tint, { add: [0, 0, 0, 0], mult: [1, 1, 0, 1] })
  }, [])

  const filter = useRef(createFilter()).current
  
  useEffect(()=> {
    const app = new PIXI.Application({backgroundAlpha: 0, resizeTo: ref.current})
    ref.current.innerHTML = ""
    ref.current.appendChild(app.view as HTMLCanvasElement)
    setApp(app)

    const root = app.stage.addChild(new PIXI.Container())
    root.filters = [filter]
    
    const sprites: PIXI.Sprite[] = []
    const anim = animstate

    app.ticker.add(()=> {
      // clear all sprites
      sprites.forEach(s=> s.destroy())
      sprites.length = 0
    
      // fix devicePixelRatio
      const {width, height} = app.screen
      app.view.style.width = width + "px"
      app.view.style.height = height + "px"
    
      // global coords
      root.position.set(
        app.screen.width*0.5 + render.x, 
        app.screen.height*0.75 + render.y)
      root.scale.set(render.scale)

      // update animation 
      const animList = anim.animLoader({bank: anim.bank, animation: anim.animation})
      if (!animList || animList.length === 0) return
      const animData = anim.getActualFacing(animList)
      if (!animData) return
      anim.setFrameList(animData.frame)
      anim.update(app.ticker.elapsedMS)
      const frame = anim.frameList[anim.currentFrame]
      // const frame = anim.frameList[0]
      if (!frame) return
      const tint = animstate.getTint()
      // render frame
      frame.forEach(({imghash, imgindex, layerhash, matrix})=> {
        if (!anim.shouldRender({imghash, layerhash})) return
        const [sourceBuild, symbol] = anim.getSourceBuild(imghash)
        const imgList = sourceBuild && sourceBuild.symbolMap[symbol]
        if (!imgList || imgList.length === 0) return
        const index = getImgIndex(imgList, imgindex)
        const img = imgList[index]
        // add sprite
        const {bbx, bby, cw, ch, x, y, w, h, sampler} = img
        const atlas: ImageBitmap & {imgs: {[K: string]: PIXI.Texture}} = anim.atlasLoader({build: sourceBuild.name, sampler}) as any
        if (!atlas) return
        if (!atlas.imgs) atlas.imgs = {}
        const id = `${symbol}@${img.index}`
        if (!atlas.imgs[id]){
          const {width: WIDTH, height: HEIGHT} = atlas
          const x_scale = WIDTH / cw, y_scale = HEIGHT / ch
          // TODO: check performance
          atlas.imgs[id] = new PIXI.Texture(
            PIXI.Texture.from(atlas).baseTexture,
            new PIXI.Rectangle(int(bbx*x_scale), int(bby*y_scale), int(w*x_scale), int(h*y_scale)),
            new PIXI.Rectangle(0, 0, cw, ch))
            atlas.imgs[id].defaultAnchor = new PIXI.Point(-x/w+0.5, -y/h+0.5)
        }
        const sp = new PIXI.Sprite(atlas.imgs[id])
        // sp.tint = 0xFF0000
        // sp.alpha = 0.1
        // sp.filters = [filter]
        // sp.filterArea = new PIXI.Rectangle(0,0,1,2)
        // set tint value
        // sp.filters[0].uniforms.mult = tint.mult
        // sp.filters[0].uniforms.add = tint.add
        // console.log(tint)
        root.filters[0].uniforms.mult = tint.mult
        root.filters[0].uniforms.add = tint.add
        sp.position.set(0,0)
        // @ts-ignore
        sp.transform.affineTransform = [...matrix]
        sprites.push(root.addChild(sp))
      })
    })

    app.start()

    return ()=> {
      app.destroy()
      setApp(undefined)
    }
  }, [])

  const {left} = props
  const [colorType, setColorType] = useState<"solid" | "grid">("solid")
  const [colorValue, setColorValue] = useState("#aaaaaa")
  const gridStyle: React.CSSProperties = colorType === "grid" && {
    backgroundImage: "linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%), linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%)",
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0, 8px 8px",
  }
  const axisColor = colorType === "grid" ? "#111" : 
    "#aaa"
  
  const onMove = useCallback((x: number, y: number)=> {
    render.offset(x, y)
    appWindow.emit("forceupdate")
  }, [render])
  const [onMouseDown] = useMouseDrag(onMove)

  const onSrollChange = useCallback((y: number)=> {
    render.scroll(y)
    appWindow.emit("forceupdate")
  }, [render])
  const [onScroll, onMouseEnter, onMouseLeave] = useMouseScroll(onSrollChange)

  return (
    <div>
      <div 
        className={style["animation-panel"]} 
        style={{
          left, 
          width: `calc(100vw - ${left}px)`, 
          height: `calc(100vh - 120px)`,
          backgroundColor: colorType === "solid" ? colorValue : "#ccc",
          ...gridStyle,
        }}>
        {
          render.axis === "back" && 
          <>
            <div className={style["x-axis"]} style={{left: 0, top: `calc(75% + ${render.y}px)`, backgroundColor: axisColor}}/>
            <div className={style["y-axis"]} style={{left: `calc(50% + ${render.x}px)`, top: 0, backgroundColor: axisColor}}/>
          </>
        }
        <div ref={ref} className={style["pixi-app"]}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onWheel={onScroll}
          onMouseDown={onMouseDown}/>
        {
          render.axis === "front" && 
          <>
            <div className={style["x-axis"]} style={{left: 0, top: `calc(75% + ${render.y}px)`, backgroundColor: axisColor}}/>
            <div className={style["y-axis"]} style={{left: `calc(50% + ${render.x}px)`, top: 0, backgroundColor: axisColor}}/>
          </>
        }
  
        <div 
          className={style["player"]}
          style={{height: 120}}
        >
          <AnimPlayerWidget animstate={animstate}/>

        </div>

        <div
          className={style["tools"]}>
          <Tools
            colorSetterProps={{colorType, colorValue, setColorType, setColorValue}}/>

        </div>
      </div>
    </div>
  )
}

function Tools(props: {colorSetterProps: any}) {
  const {render} = useContext(animstateContext)
  return (
    <ButtonGroup vertical minimal>
      <Popover2 minimal placement="left-start" popoverClassName={style["tools-popover"]}
        content={<BackgroundSetter {...props.colorSetterProps}/>}>
        <Button icon="style"/>
      </Popover2>
      <Popover2 minimal placement="left-start" popoverClassName={style["tools-popover"]}
        content={<AxisSetter/>}>
        <Button icon="plus"/>
      </Popover2>
      <Button icon="reset" onClick={()=> [render.reset(), appWindow.emit("forceupdate")]}/>
    </ButtonGroup>
  )
}

function BackgroundSetter(props: any) {
  const { colorType, colorValue, setColorType, setColorValue } = props
  const onChangeColor = useCallback((e: React.ChangeEvent<HTMLInputElement>)=> {
    setColorType("solid")
    setColorValue(e.target.value)
  }, [setColorType, setColorValue])

  return (
    <div className={style["tools-panel"]}>
      <H6>背景色</H6>
      <div className={style["tools-panel-sep"]} />
      {/* <RadioGroup> */}
        <Radio label='纯色' inline checked={colorType === "solid"} onChange={()=> setColorType("solid")}/>
        <input type="color" style={{display: "inline-block"}} value={colorValue} onChange={onChangeColor}/>
        <Radio label='网格' inline checked={colorType === 'grid'} onChange={()=> setColorType("grid")}/>
      {/* </RadioGroup> */}

    </div>
  )
}

function AxisSetter() {
  const {render} = useContext(animstateContext)
  return (
    <div className={style["tools-panel"]}>
      <H6>坐标轴</H6>
      <div className={style["tools-panel-sep"]} />
      <RadioGroup selectedValue={render.axis} onChange={e=> {
        render.axis = e.currentTarget.value as typeof render.axis
        appWindow.emit("forceupdate")
      }}>
        <Radio label="显示在前" value="front"/>
        <Radio label="显示在后" value="back"/>
        <Radio label="关" value="none"/>
      </RadioGroup>
    </div>
  )
}