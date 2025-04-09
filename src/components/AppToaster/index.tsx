import { OverlayToaster, ToastProps, Position, ProgressBar } from "@blueprintjs/core"
import React, { useEffect, useRef } from 'react'
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import { useSelector } from "../../redux/store"
import { openAnimSubwindow } from "../../pages/AnimListPage/util"
import { useLocalStorage } from "../../hooks"
const appWindow = getCurrentWebviewWindow()

type AppToasterProps = {
  top?: number
}

type AppToasterPayload = 
  string |
  ToastProps & { savepath?: string, anim_subwindow_id?: string }

export default function AppToaster(props: AppToasterProps) {
  const ref = useRef<OverlayToaster>()
  const root = useSelector(({appsettings})=> appsettings.last_dst_root)
  const [numToast] = useLocalStorage("toast_max_num")
  const [aliveTime] = useLocalStorage("toast_alive_time")

  const aliveTimeMs = aliveTime * 1000

  useEffect(()=> {
    let unlisten = appWindow.listen<AppToasterPayload>("toast", ({payload})=> {
      if (typeof payload === "string") {
        ref.current.show({message: payload, timeout: aliveTimeMs})
      }
      else {
        if (payload.savepath) {
          payload.action = {
            // icon: "flow-review",
            text: "查看", 
            onClick: ()=> invoke("select_file_in_folder", {path: payload.savepath})
          }
          payload.timeout = aliveTimeMs
        }
        else if (payload.anim_subwindow_id) {
          payload.action = {
            text: "",
            icon: "document-open",
            onClick: ()=> openAnimSubwindow({id: payload.anim_subwindow_id})
          }
          payload.timeout = aliveTimeMs
        }
        else if (typeof payload.timeout !== "number"){
          payload.timeout = aliveTimeMs
        }
        ref.current.show(payload)
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [aliveTimeMs])

  useEffect(()=> {
    ref.current.clear()
  }, [aliveTime, numToast])

  const progressKey = useRef<string>("")

  // index progress listener
  // TODO: 等正式版可能需要做的更漂亮一些
  useEffect(()=> {
    let timer = 0
    let unlisten = listen<string>("index_progress", ({payload})=> {
      if (location.pathname.indexOf("/welcome") !== -1)
        return
      const progress = Number(payload)
      const props: ToastProps = {
        icon: "git-repo",
        intent: "none",
        isCloseButtonShown: false,
        timeout: 0,
        message: (
          <div style={{display: "flex"}}>
            正在加载资源文件
            <div style={{marginLeft: 10, width: 100, paddingTop: 5}}>
              <ProgressBar value={progress} intent="success" stripes/>
            </div>
          </div>
        ),
      }
      if (progressKey.current === ""){
        if (!timer){
          timer = setTimeout(()=> {
            progressKey.current = ref.current.show(props)
          }, 10) as unknown as number
        }
        if (progress === 1){
          clearTimeout(timer)
          timer = 0
        }
      }
      else if (progress < 1){
        ref.current.show(props, progressKey.current)
      }
      else {
        clearTimeout(timer)
        timer = 0
        ref.current.dismiss(progressKey.current, true)
      }
    })
    return ()=> {
      unlisten.then(f=> f())
      clearTimeout(timer)
      ref.current?.dismiss(progressKey.current, true)
      progressKey.current = ""
    }
  }, [root])

  return (
    <div style={{position: "fixed", top: props.top || 0, right: 30, zIndex: 30}}>
      <OverlayToaster maxToasts={numToast} position={Position.TOP_RIGHT} ref={ref} usePortal={false}/>
    </div>
  )
}
