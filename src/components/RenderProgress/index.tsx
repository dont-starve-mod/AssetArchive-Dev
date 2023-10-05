import { Dialog, DialogBody, H5, ProgressBar } from '@blueprintjs/core'
import React, { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api'
// @ts-ignore
import aris from './aris.gif'

type RenderEvent = {
  state: "start",
} | {
  state: "render_element",
  progress: number,
} | {
  state: "render_canvas",
  progress: number,
} | {
  state: "finish",
  path: string,
}

const STEP_1_WIDTH = 0.4
const STEP_2_WIDTH = 0.6

export default function RenderProgress() {
  const [open, setOpen] = useState(true)
  const handleClose = useCallback(()=> {
    setOpen(false)
    invoke("interupt", { type: "render_animation_sync" } )
  }, [])
  const [percent, setPercent] = useState(0)
  const [path, setPath] = useState("")
  useEffect(()=> {
    const handlers = [
      listen<string>("render_event", ({payload})=> {
        const data: RenderEvent = JSON.parse(payload)
        if (data.state === "start"){
          setOpen(true)
          setPath("")
          setPercent(0)
        }
        else if (data.state === "render_element")
          setPercent(data.progress * STEP_1_WIDTH)
        else if (data.state === "render_canvas")
          setPercent(data.progress * STEP_2_WIDTH + STEP_1_WIDTH)
        else if (data.state === "finish") {
          setPercent(1)
          setPath(data.path)
        }
      })
    ]

    return () => { handlers.forEach(v=> v.then(f=> f())) }
  }, [])

  return (
    <Dialog title="" isOpen={open} onClose={handleClose}>
      <DialogBody>
        <div style={{display: "flex", justifyContent: "center"}}>
          <Aris/>
          <div style={{marginLeft: 20, width: 300}}>
            {
              !path && <>
                <H5>正在导出 {Math.round(percent* 100) + "%"}</H5>
                <ProgressBar value={percent}/>
              </>
            }
            {
              path && <>
                <H5>导出成功！</H5>
                <p>文件在: <a onClick={()=> invoke("select_file_in_folder", {path})}>{path}</a></p>
              </>
            }
          </div>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function Aris(){
  return (
    <div style={{width: 100, height: 100, position: "relative", backgroundColor: "transparent"}}>
      <div style={{transform: "scale(0.5) translate(-50%, -50%)", position: "absolute", left: 0, top: 0}} draggable="false">
        <div style={{width: 200, height: 200, borderRadius: 100, backgroundColor: "rgb(146,218,252)", overflow: "hidden", position: "relative"}}>
          <img src={aris} height={200} style={{position: "absolute", transform: "scale(1.1) translate(-25px, -18px)"}}/>
        </div>
      </div>
    </div>
  )
}
