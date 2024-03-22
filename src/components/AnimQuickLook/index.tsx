import React, { useCallback, useEffect, useRef, useState } from 'react'
import AnimCore from '../AnimCore_Canvas'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { RenderParams } from '../AnimCore_Canvas/renderparams'
import { Button, Menu, MenuItem } from '@blueprintjs/core'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { useQuickLookCmds, useQuickLookExport } from './util'
import { appWindow } from '@tauri-apps/api/window'
import MiniAnimPlayerWidget from '../MiniAnimPlayerWidget'
import { useLocalStorage } from '../../hooks'

type Placement = {
  width: number,
  height: number,
  x: number,
  y: number,
  scale: number,
}

type PlacementCalculator = (
  rect: {left: number, right: number, top: number, bottom: number},
  options: {maxAspectRatio: number, minAspectRatio: number, width: number} )=> Placement

type AnimQuickLookProps = {
  bankhash: number,
  animation: string,
  build: string,
  facing: number,
  width?: number,
  maxAspectRatio?: number,
  minAspectRatio?: number,
  placementFn?: PlacementCalculator,
  onResize?: ()=> void,
  noCog?: boolean,
  animstateRef?: (anim: AnimState)=> void,
}

const defaultPlacement: PlacementCalculator = (rect, options)=> {
  const WIDTH = rect.right - rect.left
  const HEIGHT = rect.bottom - rect.top
  // const CENTER_X = (rect.right + rect.left) / 2
  // const CENTER_Y = (rect.bottom + rect.top) / 2
  // keep width as 250
  // keep height in ratio but limit in [100, 400]
  const width = options.width
  const w_scale = width / WIDTH
  const height = Math.max(
    options.minAspectRatio * width, 
    Math.min(options.maxAspectRatio * width, width / WIDTH * HEIGHT))
  const h_scale = height / HEIGHT
  const x = -rect.left * w_scale
  const y = -rect.top * h_scale

  return { width, height, x, y, scale: w_scale }
}

const GREY = {color: "#aaa"}

export default function AnimQuickLook(props: AnimQuickLookProps) {
  const {bankhash, animation, build, facing, animstateRef} = props
  const {placementFn = defaultPlacement, width = 250, maxAspectRatio = 1.6, minAspectRatio = 0.4, onResize} = props
  const [placement, setPlacement] = useState({width: 100, height: 100, x: 0, y: 0})
  const animstate = useRef(new AnimState()).current
  const render = useRef<RenderParams>()
  const data = {bank: bankhash, animation, build, facing}

  useEffect(()=> {
    if (typeof animstateRef === "function")
      animstateRef(animstate)
  }, [animstate, animstateRef])

  const cmds = useQuickLookCmds(data)
  useEffect(()=> {
    animstate.clear()
    animstate.facing = facing
    animstate.setApiList([
      animation ? {name: "SetBankAndPlayAnimation", args: [bankhash, animation]} : undefined,
      build ? {name: "AddOverrideBuild", args: [build]} : undefined,
      ...cmds
    ].filter(v=> v !== undefined) as any)
    const onChangeRect = ()=> {
      const p = placementFn(animstate.rect, {maxAspectRatio, minAspectRatio, width})
      setPlacement(p)
      const r = render.current
      if (r) {
        r.centerStyle = "origin"
        r.applyPlacement(p)
      }
    }
    animstate.addEventListener("changerect", onChangeRect)
    return ()=> animstate.removeEventListener("changerect", onChangeRect)
  }, [bankhash, animation, build, placementFn, animstate, facing,
      width, maxAspectRatio, minAspectRatio, cmds])

  useEffect(()=> {
    if (typeof onResize === "function")
      onResize()
  }, [placement, onResize])

  const renderRef = useCallback((v: any)=> {
    render.current = v
  }, [])

  const [showPlayer, setShowPlayer] = useState(false)
  const [pin] = useLocalStorage("quicklook_pin_player_widget")
  const exportFn = useQuickLookExport(animstate)

  return (
    <div className="select-none relative">
      <AnimCore
        width={Math.floor(placement.width)}
        height={Math.floor(placement.height)}
        animstate={animstate}
        renderRef={renderRef}
        // bgc="#ddd"
      />
      <div style={{position: "absolute", right: 8, top: 8, display: props.noCog ? "none" : undefined}}>
        {/* <Popover2
          minimal
          placement="left"
          content={<QuickLookSettings/>}>
          <Button icon="cog"/>
        </Popover2> */}
        <Tooltip2 content="配置">
          <Button icon="cog" onClick={()=> appWindow.emit("quick_settings",
            {key: "AnimQuickLook", data})}/>
        </Tooltip2>
        <div style={{height: 4}}/>
        <Popover2 content={
          <Menu>
            <MenuItem icon="image-rotate-right" text={<>动图 <span style={GREY}>gif</span></>} onClick={()=> exportFn("gif")}/>
            <MenuItem icon="video" text={<>视频 <span style={GREY}>mp4</span></>}  onClick={()=> exportFn("mp4")}/>
            <MenuItem icon="video" text={<>无损视频 <span style={GREY}>mov</span></>} onClick={()=> exportFn("mov")}/>
            <MenuItem icon="widget" text={<>当前帧截图 <span style={GREY}>png</span></>} onClick={()=> exportFn("snapshot")}/>
          </Menu>
        } minimal>
          <Tooltip2 content="快速导出">
            <Button icon="export"/>
          </Tooltip2>
        </Popover2>
        {/* <Button icon="reset" style={{position: "absolute"}}/> */}
      </div>
      <div style={{position: "absolute", display: "flex", justifyContent: "center",
        left: 0, bottom: 0, width: "100%", paddingTop: 10, paddingBottom: 10,
        transition: "all .2s",
        opacity: (showPlayer || pin) ? 1 : 0}}
          onMouseEnter={()=> setShowPlayer(true)}
          onMouseLeave={()=> setShowPlayer(false)}
          >
        <MiniAnimPlayerWidget animstate={animstate}/>
      </div>
    </div>
  )
}