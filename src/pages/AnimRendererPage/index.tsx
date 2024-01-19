import React, { useState, useRef, useEffect } from 'react'
import SidePanel from './sidepanel'
import AnimationPanel from './animationpanel'
import { useParams } from 'react-router-dom'
import animstateContext from './globalanimstate'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import type { Api } from '../../components/AnimCore_Canvas/animstate'
import { useAnimStateHook } from '../../components/AnimCore_Canvas/animhook'
import AssetManager from '../../components/AssetManager'
import { appWindow } from '@tauri-apps/api/window'
import { RenderParams } from '../../components/AnimCore_Canvas/renderparams'
import { useLuaCall, useLuaCallOnce } from '../../hooks'
import { Menu, MenuItem } from '@blueprintjs/core'
import { invoke } from '@tauri-apps/api'
import AppToaster from '../../components/AppToaster'
import AppRendererInit from '../../components/AppRendererInit'
import RenderProgress from '../../components/RenderProgress'

const bodyStyle: React.CSSProperties = {
  position: "relative", 
  overflowY: "hidden", 
  height: "100vh",
  userSelect: "none",
  WebkitUserSelect: "none",
}

export default function AnimRendererPage() {
  const {id} = useParams()
  const [panelWidth, setPanelWidth] = useState<number>(250)
  const animstate = useRef(new AnimState()).current
  const animstateHooks = useAnimStateHook(animstate)
  const render = useRef(new RenderParams()).current

  const assetStateRef = useRef<any>()

  useLuaCallOnce<string>("animproject", (result)=> {
    const data: any = JSON.parse(result)
    const cmds: Api[] = data.cmds
    animstate.clear()
    animstate.setApiList(cmds)
    animstateHooks.forceUpdate()
  }, {id, type: "load"}, [id])

  // auto save...
  // TODO: 可能需要一个更好的实现
  useEffect(()=> {
    const save = ()=> {
      const data = {
        id,
        api_list: animstate.getApiList(),
        render_param: {
          ...render.serialize(),
          facing: animstate.getActualFacing(),
        }
      }
      invoke("lua_call", {api: "animproject", param: JSON.stringify({
        type: "save",
        data,
      })}).then(
        ()=> {},
        error=> console.error("Error in autosave:", error)
      )
    }
    const timer = setInterval(save, 10*1000)
    return ()=> clearInterval(timer)
  }, [id])

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
      <AppToaster/>
    </animstateContext.Provider>
  )
}
