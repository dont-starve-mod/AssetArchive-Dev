import { Dialog, DialogBody, H5, ProgressBar } from '@blueprintjs/core'
import { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api'
import { openInstaller } from '../../pages/FFmpegInstaller'
// @ts-ignore
import aris_working from './aris-working.gif'
// @ts-ignore
import aris_failed from './aris-failed.png'
// @ts-ignore
// import aris_finish from './aris-finish.gif'
// @ts-ignore
import aris_finish_new from './aris-finish-new.gif'
import { appWindow } from '@tauri-apps/api/window'

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
} | {
  state: "error",
  message: string,
}

const STEP_1_WIDTH = 0.4
const STEP_2_WIDTH = 0.6

export default function RenderProgress(props: {isMain?: boolean}) {
  const {isMain} = props
  const [open, setOpen] = useState(false)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState("")
  const [path, setPath] = useState("")
  const [currentSessionId, setCurrentSessionId] = useState("")

  const inProgress = percent >= 0 && percent < 1
  const handleClose = useCallback(()=> {
    setOpen(false)
    if (inProgress){
      invoke("lua_interrupt", {})
    }
  }, [inProgress])

  useEffect(()=> {
    if (isMain) setCurrentSessionId("quicklook_export")
  }, [isMain])

  useEffect(()=> {
    const handlers = [
      listen<string>("render_event", ({payload})=> {
        const data: RenderEvent & {session_id: string} = JSON.parse(payload)
        if (data.session_id !== currentSessionId)
          return
        if (data.state === "start"){
          setOpen(true)
          setPath("")
          setError("")
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
        else if (data.state === "error") {
          setPercent(0.3)
          setError(data.message)
        }
      })
    ]

    return () => { handlers.forEach(v=> v.then(f=> f())) }
  }, [currentSessionId])

  useEffect(()=> {
    let unlisten = appWindow.listen<string>("set_session_id", ({payload})=> {
      console.log("Current session id is:", payload)
      setCurrentSessionId(payload)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [setCurrentSessionId])

  useEffect(()=> {
    let unlisten = appWindow.listen<never>("lua_call_error_emitted", ()=> {
      // TODO: 注意，这个监听器默认导出过程是sync的
      // 如果后续使用多线程渲染，则需要格外注意
      setError("internal")
      setPercent(0.3)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  return (
    <Dialog title="" isOpen={open} onClose={handleClose}
      style={{userSelect: "none", WebkitUserSelect: "none"}}
      canEscapeKeyClose={false} canOutsideClickClose={false}>
      <DialogBody>
        <div style={{display: "flex", justifyContent: "center"}}>
          <Aris state={error ? "failed" : path ? "finish" : "working"}/>
          <div style={{marginLeft: 20, width: 300}}>
            {
              !path && <>
                <H5>
                  {
                    !Boolean(error) ? 
                    `正在导出 ${Math.round(percent* 100)}%` :
                    `导出失败`
                  }
                </H5>
                <ProgressBar value={percent} intent={error ? "danger" : "none"}/>
                <div style={{marginTop: 10}}>
                  {
                    error.toLowerCase().indexOf("ffmpeg") !== -1 &&
                    <p>还没有安装<a onClick={()=> openInstaller()}>FFmpeg</a>，无法导出gif/mp4/mov格式。</p>
                  }
                </div>
              </>
            }
            {
              path && <>
                <H5>导出成功！</H5>
                <p>文件在: <a style={{wordWrap: "break-word"}} onClick={()=> invoke("select_file_in_folder", {path})}>{path}</a></p>
              </>
            }
          </div>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function Aris({state}: {state: "working" | "failed" | "finish"}){
  const color = state === "working" ? "rgb(146,218,252)" : 
    state === "failed" ? "#f66" : 
    state === "finish" ? "#8f8" : ""
  return (
    <div style={{width: 100, height: 100, position: "relative", backgroundColor: "transparent",
      pointerEvents: "none"}} draggable="false">
      <div style={{transform: "scale(0.5) translate(-50%, -50%)", position: "absolute", left: 0, top: 0}} draggable="false">
        <div style={{width: 200, height: 200, borderRadius: 100, backgroundColor: color, transition: "all .7s", overflow: "hidden", position: "relative"}}>
          {
            state === "working" &&
            <img src={aris_working} height={200} style={{position: "absolute", transform: "scale(1.2) translate(-22px, -15px)"}}/>
          }
          {
            state === "failed" && 
            <img src={aris_failed} height={180} style={{position: "absolute", transform: "translate(0px, -5px)"}}/>
          }
          {
            state === "finish" &&
            <img src={aris_finish_new} height={210} style={{position: "absolute", transform: "scale(1.2) translate(24px, -12px)"}}/>
          }
        </div>
      </div>
    </div>
  )
}
