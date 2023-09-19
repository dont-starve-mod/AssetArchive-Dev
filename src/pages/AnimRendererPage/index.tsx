import React, { useState, useRef } from 'react'
import SidePanel from './sidepanel'
import AnimationPanel from './animationpanel'
import AppRendererInit from '../../components/AppRendererInit'
import { useParams } from 'react-router-dom'
import animstateContext from './globalanimstate'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import { useAnimStateHook } from '../../components/AnimCore_Canvas/animhook'

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
  const [panelWidth, setPanelWidth] = useState<number>(200)
  const animstate = useRef(new AnimState()).current
  const animstateHooks = useAnimStateHook(animstate)

  return (
    <animstateContext.Provider value={{animstate, ...animstateHooks}}>
      <div style={bodyStyle}>
        <SidePanel width={panelWidth} onChangeWidth={(v)=> setPanelWidth(v)}/>
        <AnimationPanel left={panelWidth}/>
      </div>
      <AppRendererInit/>
    </animstateContext.Provider>
  )
}
