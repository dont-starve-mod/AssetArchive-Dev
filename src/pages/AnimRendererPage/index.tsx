import React, { useState } from 'react'
import SidePanel from './sidepanel'
import AnimationPanel from './animationpanel'
import { useParams } from 'react-router-dom'

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
  return (
    <>
      <div style={bodyStyle}>
        <SidePanel width={panelWidth} onChangeWidth={(v)=> setPanelWidth(v)}/>
        <AnimationPanel left={panelWidth}/>
      </div>
    </>
  )
}
