import React, { useState, useRef, useEffect } from 'react'
import SidePanel from './sidepanel'
import AnimationPanel from './animationpanel'
import AppRendererInit from '../../components/AppRendererInit'
import RenderProgress from '../../components/RenderProgress'
import { useParams } from 'react-router-dom'
import animstateContext from './globalanimstate'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import { useAnimStateHook } from '../../components/AnimCore_Canvas/animhook'
import AssetManager from '../../components/AssetManager'
import { appWindow } from '@tauri-apps/api/window'
import { RenderParams } from '../../components/AnimCore_Canvas/renderparams'

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

  useEffect(()=> {
    return
    animstate.clear()
    animstate.insert({name: "SetBuild", args: ["wilson"]})
    animstate.insert({name: "SetBankAndPlayAnimation", args: ["wilson", "run_loop"]})
    animstate.insert({name: "HideSymbol", args: ["face"]})
    animstate.insert({name: "Hide", args: ["SWAP_object_0"]})
    animstate.insert({name: "SetAddColour", args: [1,1,1,0]})
    animstate.insert({name: "SetSymbolAddColour", args: ["", 1, 1, 1, 1]})
    setPanelWidth(251)
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
