import React, { useState, useRef, useEffect } from 'react'
import SidePanel from './sidepanel'
import AnimationPanel from './animationpanel'
import AppRendererInit from '../../components/AppRendererInit'
import RenderProgress from '../../components/RenderProgress'
import { useParams } from 'react-router-dom'
import animstateContext from './globalanimstate'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import type { Api } from '../../components/AnimCore_Canvas/animstate'
import { useAnimStateHook } from '../../components/AnimCore_Canvas/animhook'
import AssetManager from '../../components/AssetManager'
import { appWindow } from '@tauri-apps/api/window'
import { RenderParams } from '../../components/AnimCore_Canvas/renderparams'
import { useLuaCall, useLuaCallOnce } from '../../hooks'
import { ContextMenu2, ContextMenu2Popover } from '@blueprintjs/popover2'
import { Menu, MenuItem } from '@blueprintjs/core'

interface IProps {
  
}

const bodyStyle: React.CSSProperties = {
  position: "relative", 
  overflowY: "hidden", 
  height: "100vh",
  userSelect: "none",
  WebkitUserSelect: "none",
}

export default function AnimRendererPage(props: IProps) {
  const {id} = useParams()
  const [panelWidth, setPanelWidth] = useState<number>(250)
  const animstate = useRef(new AnimState()).current
  const animstateHooks = useAnimStateHook(animstate)
  const render = useRef(new RenderParams()).current

  const assetStateRef = useRef<any>()

  useLuaCallOnce<string>("animproject", (result)=> {
    const data: any = JSON.parse(result)
    console.log(data)
    const cmds: Api[] = data.cmds
    animstate.clear()
    animstate.setApiList(cmds)
    animstateHooks.forceUpdate()
  }, {id, type: "load"}, [id])

  useEffect(()=> {

    animstate.insert({name: "SetBank", args: ["1"]}, 0)
  }, [])
  useEffect(()=> {
    const unlisten = appWindow.listen<any>("forceupdate", ({payload})=> {
      console.log("ForceUpdate event from:", payload)
      animstateHooks.forceUpdate()
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  // @ts-ignore
  window.anim = animstate 
  // @ts-ignore
  window.render = render

  return (
    <animstateContext.Provider value={{animstate, render, assetstate: assetStateRef.current, ...animstateHooks}}>
      <div style={bodyStyle}>
        <SidePanel width={panelWidth} onChangeWidth={(v)=> setPanelWidth(v)}/>
        <AnimationPanel left={panelWidth}/>
      </div>
      <AppRendererInit/>
      <AssetManager animstate={animstate} stateRef={state=> assetStateRef.current = state}/>
      <RenderProgress/>
    </animstateContext.Provider>
  )
}
