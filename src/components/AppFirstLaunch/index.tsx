import React, { KeyboardEvent, useCallback, useEffect, useState } from 'react'
import style from './index.module.css'
import { Button, Callout, Collapse, Dialog, DialogBody, DialogFooter, H3, H5, Icon, InputGroup, ProgressBar } from '@blueprintjs/core'
import { appWindow } from '@tauri-apps/api/window'
import { useLuaCall } from '../../hooks'
import { listen } from '@tauri-apps/api/event'

// @ts-ignore
import steam_dst from '../../media/steam-dst.mp4'
// @ts-ignore
import wg_dst from '../../media/wg-dst.mp4'
import { useNavigate } from 'react-router-dom'

type IndexState = {
  type: "start"
} | {
  type: "progress",
  percent: number,
} | {
  type: "finish"
} | {
  type: "off"
}

export function getGameTypeByRoot(path: string): "ds" | "dst" | "unknown" {
  // strip last /Contents/data or /data
  if (path.endsWith("/Contents/data"))
    path = path.slice(0, path.length - 14)
  else if (path.endsWith("/data"))
    path = path.slice(0, path.length - 5)

  const stem = path.match(/[^/]+$/)?.[0]
  if (!stem) return "unknown"

  switch (stem) {
    case "dontstarve_dedicated_server_nullrenderer.app":
      return "dst"
    case "dontstarve_steam.app":
      return path.endsWith("Don't Starve Together/dontstarve_steam.app") ? "dst" : "ds"
    case "Don't Starve Together":
    case "Don't Starve Together Dedicated Server":
      return "dst"
    case "Don't Starve":
      return "ds"
    default:
      // TGP platform
      // not an accurate result on this branch...
      return path.indexOf("(2000004)") !== -1 ? "dst" : "ds"
  }
}

export default function AppFirstLaunch() {
  const [installed, setInstalled] = useState<"yes"|"no"|"">("")
  const [guideOpen, setGuideOpen] = useState<"steam-dst"|"wg-dst"|"">("")
  const [path, setPath] = useState("")
  const [indexState, setIndexState] = useState<IndexState>({type: "off"})
  const [dsWarning, setDSWarning] = useState(false)

  const call = useLuaCall<"true"|"false">("setroot", result=> {
    if (result === "true") {
      setIndexState({type: "finish"})
    }
    else {
      appWindow.emit("alert", {title: "设置失败", message: "不是一个有效的游戏资源目录"})
    }
  }, {}, [])

  const validatePath = useCallback(()=> {
    if (path){
      call({path})
    }
  }, [path, call])

  useEffect(()=> {
    const handlers = [
      listen<string>("update_setting", ({payload})=> {
        const data = JSON.parse(payload)
        if (data.key === "last_dst_root" && data.value){
          setIndexState({type: "start"})
          if (getGameTypeByRoot(data.value) === "ds"){
            setDSWarning(true)
          }
        }
      }),
      listen<string>("index_progress", ({payload})=> {
        const percent = Number(payload)
        setIndexState(percent < 1 ? {type: "progress", percent} : {type: "finish"})
      })
    ]
    return ()=> {
      handlers.forEach(v=> v.then(f=> f()))
    }
  })

  useEffect(()=> {
    const unlisten = appWindow.onFileDropEvent(event=> {
      const type = event.payload.type
      if (type === "hover") {
        // setHover(true)
      }
      else if (type === "drop") {
        // setHover(false)
        setPath(event.payload.paths[0])
      }
      else {
        // setHover(false)
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [setPath])

  const onKeyDown = useCallback((e: KeyboardEvent)=> {
    if (e.key === "Enter"){
      validatePath()
    }
  }, [validatePath])

  const navigate = useNavigate()

  return (
    <div className='bp4-running-text'>
      <H3 style={{marginTop: 15}}>开始使用
        <Icon size={20} icon="rocket-slant" style={{verticalAlign: "middle", marginLeft: 4}}/>
      </H3>
      <p>饥荒资源档案是一个易用的饥荒游戏资源读取工具。</p>
      <p>你的电脑上是否有安装饥荒游戏？</p>
      <Button large intent={installed === "yes" ? "primary" : "none"} style={{marginRight: 10}} onClick={()=> setInstalled("yes")}>安装好了</Button>
      <Button large intent={installed === "no" ? "primary": "none"} onClick={()=> setInstalled("no")}>还没有安装..</Button>
      <div style={{height: 10}}/>
      <Collapse isOpen={installed === "no"} transitionDuration={100}>
        <H5>安装游戏</H5>
        <p>先通过Steam等游戏平台安装饥荒吧，查理会耐心等你回来。</p>
        <Callout>
        <p>小贴士：除了购买游戏安装外，也可选择免费的<strong>饥荒联机版专用服务器</strong>，这是官方提供的服务器程序，虽然不能直接游玩，但也附带了完整的游戏资源。</p>
        </Callout>
      </Collapse>
      <Collapse isOpen={installed === "yes"} transitionDuration={100} keepChildrenMounted>
        <H5>找到游戏的安装目录</H5>
        <ul>
          <li>Steam平台：在游戏库中右键 <Icon icon="chevron-right"/> 管理 <Icon icon="chevron-right"/> 浏览本地文件。
            <Button text="详情" onClick={()=> setGuideOpen("steam-dst")}/>
          </li>
          <li>WG平台：在游戏库中右键 <Icon icon="chevron-right"/> 目录。
            <Button text="详情" onClick={()=> setGuideOpen("wg-dst")}/>
          </li>
        </ul>
        <H5>粘贴路径</H5>
        <p>将路径粘贴到下方输入框内，或者直接把文件夹拖动到这里。</p>
        <div style={{maxWidth: 330}}>
          <InputGroup
            value={path} 
            onChange={e=> setPath(e.target.value)} 
            spellCheck={false}
            autoComplete="off"
            small={false}
            onKeyDown={onKeyDown}
            rightElement={<Button onClick={()=> validatePath()}>确认</Button>}
            placeholder=''/>
        </div>
      </Collapse>
      <div style={{height: 300}}/>
      <Dialog isOpen={guideOpen !== ""} onClose={()=> setGuideOpen("")} 
        style={{width: 640, borderColor: "transparent", backgroundColor: "transparent"}}>
        <Video type={guideOpen as any}/>
      </Dialog>
      <Dialog isOpen={indexState.type !== "off"} onClose={()=> {}}
        style={{width: 400}}>
        <DialogBody>
          <H5>设置成功</H5>
          {
            indexState.type !== "finish" && <>
              <p>正在努力加载游戏资源，请稍候...</p>
              <ProgressBar
                intent="primary"
                // @ts-ignore 
                value={indexState.percent || 0}/>            
            </>
          }
          {
            indexState.type === "finish" && <>
              <p>一切准备就绪。</p>
              {
                dsWarning && <Callout intent="warning">
                  <p>请注意，本软件目前对单机版的支持并不完善，例如<b>DLC资源加载功能</b>还没做完，请等待后续更新。</p>
                </Callout>
              }
            </>
          }
        </DialogBody>
        <DialogFooter>
          <div style={{width: "100%", display: "flex", justifyContent: "center"}}>
            {
              indexState.type === "finish" &&
              <Button 
                style={{width: 100}} 
                onClick={()=> {
                  setIndexState({type: "off"})
                  navigate("/")
                }}>
                启动!
              </Button>
            }
          </div>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function Video(props: {type: "wg-dst" | "steam-dst"}) {
  const {type} = props
  const src = type === "wg-dst" ? wg_dst :
    type === "steam-dst" ? steam_dst :
    undefined
  return (
    <video style={{width: "100%", borderRadius: 4}} autoPlay muted loop>
      <source src={src} />
    </video>
  )
}