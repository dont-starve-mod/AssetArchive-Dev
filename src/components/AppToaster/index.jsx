import { OverlayToaster, Position } from "@blueprintjs/core"
import React, { useEffect, useRef } from 'react'
import { appWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api"

export default function AppToaster() {
  const ref = useRef()

  useEffect(()=> {
    let unlisten = appWindow.listen("toast", ({payload})=> {
      if (typeof payload === "string") {
        ref.current.show({message: payload})
      }
      else {
        if (payload.savepath) {
          payload.action = {
            // icon: "flow-review",
            text: "查看", 
            onClick: async ()=> invoke("select_file_in_folder", {path: payload.savepath})
          }
          payload.timeout = 10*1000
        }
        ref.current.show(payload)
      }
    })
    return ()=> unlisten.then(f=> f())
  }, [])

  return <div style={{position: "fixed", top: 40, right: 30, backgroundColor: "pink"}}>
    <OverlayToaster maxToasts={5} position={Position.TOP_RIGHT} ref={ref} usePortal={false}/>
  </div>
}
