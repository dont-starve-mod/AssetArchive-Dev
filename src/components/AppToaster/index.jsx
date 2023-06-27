import { OverlayToaster, Position } from "@blueprintjs/core"
import React, { useEffect, useRef } from 'react'
import { appWindow } from "@tauri-apps/api/window"

export default function AppToaster() {
  const ref = useRef()

  useEffect(()=> {
    let unlisten = appWindow.listen("toast", ({payload})=> {
      if (typeof payload === "string") {
        ref.current.show({message: payload})
      }
      else {
        ref.current.show(payload)
      }
    })
    return ()=> unlisten.then(f=> f())
  }, [])

  return <div style={{position: "fixed", top: 40, right: 30, backgroundColor: "pink"}}>
    <OverlayToaster maxToasts={5} position={Position.TOP_RIGHT} ref={ref} usePortal={false}/>
  </div>
}
