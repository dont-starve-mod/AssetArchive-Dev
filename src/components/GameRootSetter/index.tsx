import { useCallback, useEffect, useState } from 'react'
import { Button, Dialog, Icon, InputGroup } from '@blueprintjs/core'
import { MultistepDialog, DialogStep, RadioGroup, Radio, H4 } from '@blueprintjs/core'
import { Tooltip2 } from '@blueprintjs/popover2'
import style from './index.module.css'
import { useLuaCall } from '../../hooks'
import { open } from '@tauri-apps/plugin-dialog'
// @ts-ignore
import steam_dst from '../../media/steam-dst.mp4'
// @ts-ignore
import wg_dst from '../../media/wg-dst.mp4'

const NEXT_TEXT = "下一步"
const PREV_TEXT = "上一步"
const FINAL_TEXT = "确认"

interface IProps {
  isOpen: boolean,
  onClose: any
}

/** a model that guide user to set DST game data directory path */
export default function GameRootSetter(props: IProps) {
  const {isOpen} = props
  // const isOpen = true
  const onClose = ()=> {}
  const [gametype, setGameType] = useState<
    "dst-client-installed" |
    "dst-client-uninstalled" | 
    "dst-dedicated-server">()
  const [verifying, setVerifying] = useState(false)

  const onSelectGameType = ({target})=> {
    setGameType(target.value)
  }
  return (<></>) // disabled in new version
  return <MultistepDialog 
    isOpen={isOpen}
    onClose={onClose}
    icon="folder-open"
    navigationPosition="top"
    title="设置游戏目录"
    nextButtonProps={{ text: NEXT_TEXT }}
    backButtonProps={{ text: PREV_TEXT }}
    finalButtonProps={{ text: FINAL_TEXT, loading: verifying, onClick: ()=> appWindow.emit("submit_root") }}
    style={{minWidth: 600}}
  >
    <DialogStep
      id="install-options"
      title="选择"
      panel={<GameTypePanel onChange={onSelectGameType} selectedValue={gametype}/>}
      nextButtonProps={{
        text: NEXT_TEXT,
        disabled: gametype === undefined,
        tooltipContent: gametype === undefined ? "选择一项以继续" : undefined,
      }}
    />
    <DialogStep
      id="open-game"
      title={gametype === "dst-client-installed" ? "游戏位置" : "安装游戏"}
      panel={<OpenFolderPanel gametype={gametype}/>}
      nextButtonProps={{
        text: NEXT_TEXT,
        disabled: gametype !== "dst-client-installed",
      }}
    />
    <DialogStep
      id="drag-folder"
      title="设置路径"
      panel={<DragFolderPanel/>}
    />
  </MultistepDialog>
}

function GameTypePanel(props){
  return <div className='bp4-dialog-body'>
    <H4>游戏目录</H4>
    <p>饥荒资源档案是一个易用的饥荒游戏资源读取工具。</p>
    <p>要运行本程序，必须先安装“饥荒联机版”。</p>
    <hr/>
    <RadioGroup onChange={props.onChange} selectedValue={props.selectedValue}>
      <Radio label="我已安装游戏" value="dst-client-installed" />
      <Radio label="我已购买游戏，但尚未安装" value="dst-client-uninstalled" />
      <Radio label="我还没有购买游戏" value="dst-dedicated-server" />
    </RadioGroup>
  </div>
}

function OpenFolderPanel(props: { gametype: string }){
  const { gametype } = props
  const [guideOpen, setGuideOpen] = useState("")
  return <div className="bp4-dialog-body" style={{minHeight: 160}}>
    {
      gametype === "dst-client-installed" ? <div className='bp4-running-text'>
        <p>打开游戏的安装位置。</p>
        <ul>
          <li>Steam平台：在游戏库中选择“饥荒联机版”，右键 -&gt; 管理 -&gt; 浏览本地文件。
            <Button text="详情" onClick={()=> setGuideOpen("steam-dst")}/>
          </li>
          <li>WG平台：点击饥荒，浏览游戏位置。
            <Button text="详情" onClick={()=> setGuideOpen("wg-dst")}/>
          </li>
        </ul>
      </div> :
      gametype === "dst-client-uninstalled" ? <p>
        请先安装游戏，查理会耐心等你回来..
      </p> :
      gametype === "dst-dedicated-server" ? <div className='bp4-running-text'>
        <p>你可以：</p>
        <ul>
          <li>购买并安装<strong>饥荒联机版</strong>，买不了吃亏，买不了上当。</li>
        </ul>
        <p>或者：</p>
        <ul>
          <li>安装<strong>饥荒联机版专用服务器</strong>。
           <Tooltip2 content={<div style={{width: 250}}>
              这是官方提供的游戏专用服务器，包含
              全部游戏资源文件，可免费安装。
            </div>}>
            <Icon icon="small-info-sign"/>
           </Tooltip2>
          </li>
        </ul>
        <hr/>
        <p>安装完毕后，请回到上一步，然后选择<strong>“我已安装游戏”。</strong></p>
      </div> : 
      <></>
    }
    <Dialog isOpen={guideOpen !== ""} onClose={()=> setGuideOpen("")} 
      style={{width: 600, borderColor: "transparent", backgroundColor: "transparent"}}>
      <Video type={guideOpen as any}/>
    </Dialog>
  </div>
}

export function DragFolderPanel(){
  const [hover, setHover] = useState(false)
  const [path, setPath] = useState("")

  const call = useLuaCall<string>("setroot", result=> {
    if (result === ""){
      window.emit("alert", {title: "设置失败", message: "不是一个有效的游戏资源目录"})
    }
    else {
      setPath(result)
      window.emit("alert", {intent: "primary", title: "设置成功", message: "资源目录已链接至: " + result})
    }
  }, {path}, [path])

  useEffect(()=> {
    const unlisten = window.appWindow.onDragDropEvent(event=> {
      const type = event.payload.type
      if (type === "over") {
        setHover(true)
      }
      else if (type === "drop") {
        setHover(false)
        setPath(event.payload.paths[0])
      }
      else {
        setHover(false)
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    const unlisten = window.listen("submit_root", ()=> {
      console.log(path)
      call()
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [path, call])

  const openDialog = useCallback(()=> {
    open({directory: true, title: ""}).then(
      result=> typeof result === "string" && setPath(result)
    )
  }, [])

  return (
    <div className='bp4-dialog-body min-h-[160px]'>
      {
        !hover ?
          <p style={{cursor: "pointer"}} onClick={openDialog}>
            <Icon icon="folder-close"/> 
            &nbsp;把游戏文件夹拖拽到这里。
          </p> :
          <p className={style["flash"]}>
            <Icon icon="folder-open" intent='primary'/> 
            &nbsp;现在可以松开了。
          </p>
      }
      <br/>
      <p>或者把文件夹路径粘贴到下方：</p>
      <InputGroup 
        value={path} 
        onChange={e=> setPath(e.target.value)} 
        spellCheck={false}
        placeholder=''/>
    </div>
  )
}

function VideoPopup(props: {type: string, isOpen: boolean}) {
  return (
    <Dialog isOpen={props.isOpen}>
      <Video type={props.type as any}/>
    </Dialog>
  )
}

function Video(props: {type: "wg-dst" | "steam-dst"}) {
  const {type} = props
  const src = type === "wg-dst" ? wg_dst :
    type === "steam-dst" ? steam_dst :
    undefined
  return <video style={{width: "100%"}} autoPlay muted loop>
    <source src={src} />
  </video>
}