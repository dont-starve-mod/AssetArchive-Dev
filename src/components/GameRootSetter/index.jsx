import React, { useEffect, useState } from 'react'
import { Dialog, DialogBody, DialogFooter, Button, Icon } from '@blueprintjs/core'
import { MultistepDialog, DialogStep, RadioGroup, Radio, H4 } from '@blueprintjs/core'
import { Tooltip2 } from '@blueprintjs/popover2'
import { appWindow } from '@tauri-apps/api/window'

const NEXT_TEXT = "下一步"
const PREV_TEXT = "上一步"

/* a setter widget that guide user to set DST game data directory path */
export default function GameRootSetter({isOpen, onClose}) {
  const [gametype, setGameType] = useState(null)
  const onSelectGameType = ({target})=> {
    setGameType(target.value)
  }
  return <MultistepDialog 
    isOpen={isOpen}
    onClose={onClose}
    icon="folder-open"
    navigationPosition="top"
    title="设置游戏目录"
    nextButtonProps={{
      text: NEXT_TEXT
    }}
    backButtonProps={{
      text: PREV_TEXT
    }}
    style={{minWidth: 600}}
  >
    <DialogStep
      id="install-options"
      title="选择类型"
      panel={<GameTypePanel onChange={onSelectGameType} selectedValue={gametype}/>}
      nextButtonProps={{
        text: NEXT_TEXT,
        disabled: gametype === null,
        tooltipContent: gametype === null ? "选择一项以继续" : undefined,
      }}
    />
    <DialogStep
      id="open-game"
      title="打开游戏位置"
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
    <p>要运行本程序，必须先安装“饥荒联机版”。</p>
    <RadioGroup onChange={props.onChange} selectedValue={props.selectedValue}>
      <Radio label="我已安装游戏" value="dst-client-installed" />
      <Radio label="我已购买游戏，但尚未安装" value="dst-client-uninstalled" />
      <Radio label="我还没有购买游戏" value="dst-dedicated-server" />
    </RadioGroup>
  </div>
}

function OpenFolderPanel(props){
  const { gametype } = props
  return <div className="bp4-dialog-body">
    {
      gametype == "dst-client-installed" ? <div className='bp4-running-text'>
        <p>打开游戏的安装位置。</p>
        <ul>
          <li>Steam平台：在游戏库中选择“饥荒联机版”，右键 -&gt; 管理 -&gt; 浏览本地文件。
            <Button text="教程"/>
          </li>
          <li>WG平台：点击饥荒，浏览游戏位置。
            <Button text="教程"/> TODO: 插入gif引导图
          </li>
        </ul>
      </div> :
      gametype == "dst-client-uninstalled" ? <p>
        请先安装游戏，查理会耐心等你回来..
      </p> :
      gametype == "dst-dedicated-server" ? <div className='bp4-running-text'>
        <p>你可以：</p>
        <ul>
          <li>购买并安装<strong>饥荒联机版</strong>，买不了吃亏，买不了上当。</li>
        </ul>
        <p>或者：</p>
        <ul>
          <li>安装<strong>饥荒联机版专用服务器</strong>。
           <Tooltip2 content="官方提供的游戏专用服务器，可免费安装，但不能直接游玩">
            <Icon icon="small-info-sign"/>
           </Tooltip2>
          </li>
        </ul>
        <hr/>
        <p>安装完毕后，请回到上一步，然后选择<strong>“我已安装游戏”。</strong></p>
      </div> : 
      <></>
    }
  </div>
}

function DragFolderPanel(){
  const [hover, setHover] = useState(false)
  const [path, setPath] = useState("")
  useEffect(()=> {
    const unlisten = appWindow.onFileDropEvent(event=> {
      const type = event.payload.type
      if (type === "hover") {
        setHover(true)
      }
      else if (type === "drop") {
        setHover(false)
        setPath(event.payload.paths[0])
      }
      else {
        console.log("Cancel")
        setHover(false)
      }
    })
    return ()=> unlisten.then(f=> f())

  }, [])
  return <div className='bp4-dialog-body'>
    {
      path.length > 0 ? <>
        当前路径：{path}
      </> : <> 
      {
        !hover ? <>
          <p><Icon icon="folder-close"/> 
            &nbsp;把游戏文件夹拖拽到这里。
          </p>
        </> : <>
          <p><Icon icon="folder-open" intent='success'/> 
            &nbsp;现在可以松开了。
          </p>
        </>
      }</>
    }
    
  </div>
}
