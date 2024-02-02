import React, { useCallback, useEffect, useRef, useState } from 'react'
import AnimCore from '../AnimCore_Canvas'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { RenderParams } from '../AnimCore_Canvas/renderparams'
import { Button, Dialog, DialogBody, Menu, MenuItem } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { useQuickLookCmds } from './util'
import { appWindow } from '@tauri-apps/api/window'

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

export default function AnimQuickLook(props: AnimQuickLookProps) {
  const {bankhash, animation, build, facing} = props
  const {placementFn = defaultPlacement, width = 250, maxAspectRatio = 1.6, minAspectRatio = 0.4, onResize} = props
  const [placement, setPlacement] = useState({width: 100, height: 100, x: 0, y: 0})
  const animstate = useRef(new AnimState()).current
  const render = useRef<RenderParams>()
  const data = {bank: bankhash, animation, build, facing}

  const cmds = useQuickLookCmds(data)
  useEffect(()=> {
    animstate.clear()
    animstate.facing = facing
    animstate.setApiList([
      animation ? {name: "SetBankAndPlayAnimation", args: [bankhash, animation]} : undefined,
      // {name: "SetBuild", args: ["wilson"]},
      // {name: "OverrideSymbol", args: ["swap_object", "swap_ham_bat", "swap_ham_bat"]},
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
  }, [bankhash, animation, build, placementFn, width, maxAspectRatio, minAspectRatio, cmds])

  useEffect(()=> {
    if (typeof onResize === "function")
      onResize()
  }, [placement, onResize])

  const renderRef = useCallback((v: any)=> {
    render.current = v
  }, [])

  return (
    <div style={{position: "relative"}}>
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
        <Button icon="cog" onClick={()=> appWindow.emit("quick_settings",
          {key: "AnimQuickLook", data})}/>
        {/* <Button icon="reset" style={{position: "absolute"}}/> */}
      </div>
    </div>
  )
}