import React, { useCallback, useEffect, useState } from 'react'
import { Menu, MenuDivider, MenuItem, IconName } from '@blueprintjs/core'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppSetting } from '../../hooks'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { LogicalSize } from '@tauri-apps/api/dpi'
const appWindow = getCurrentWebviewWindow()

function MenuNavLink(props: 
  {icon: IconName, text: string, to: string, redirectNoRoot?: boolean}) {
  const navigate = useNavigate()
  const [root] = useAppSetting("last_dst_root")
  const path = useLocation().pathname
  const { icon, text, to, redirectNoRoot } = props
  const onClick = useCallback(()=> {
    if (!root && redirectNoRoot){
      navigate("/welcome")
    }
    else{
      navigate(to)
    }
  }, [root, to, redirectNoRoot, navigate])
  return <MenuItem
    icon={icon}
    text={text}
    onClick={onClick}
    intent={path.indexOf(to) !== -1 ? "primary" : "none"}
  />
}

export default function MainMenu() {
  const [isDebug, setIsDebug] = useState(false)
  const [hideDebug, setHideDebug] = useState(false)

  useEffect(()=> {
    invoke<boolean>("get_is_debug").then(setIsDebug)
  }, [])

  const location = window.location

  return (
    <Menu style={{minWidth: "100%", backgroundColor: "transparent"}}>
      <MenuNavLink icon="git-repo" to="/asset-group" text="游戏资源" redirectNoRoot/>
      <MenuNavLink icon="walk" to="/anim-list" text="动画渲染器" redirectNoRoot/>
      {/* <div onClick={()=> alert("这个功能还没做完 _(:з」∠)_")}><MenuNavLink icon="color-fill" to="/filter" text="滤镜渲染器" /></div> */}
      {/* <MenuNavLink icon="build" to="/mod-tools" text="模组工具箱" /> */}
      {/* <MenuNavLink icon="bug" to="/about#bug" text="反馈bug" /> */}
      <MenuDivider />
      {
        // only show in `npm run tauri dev`
        isDebug && !hideDebug && <MenuItem icon="bug" text="Debug">
          <MenuItem text="刷新" onClick={()=> location.href = location.href}/>
          <MenuItem text="重载Lua" onClick={()=> invoke("lua_reload").then(
            ()=> location.href = location.href,
            error=> window.alert("Failed to reload:\n" + error)
          )}/>
          <MenuItem text="center" onClick={async ()=> {
            await appWindow.setSize(new LogicalSize(900, 675))
            await appWindow.center()
          }}/>
          <MenuItem text="hide" onClick={()=> setHideDebug(true)}/>
        </MenuItem>
      }
      <MenuNavLink icon="cog" to="/settings" text="设置"/>
      <MenuNavLink icon="heart" to="/about" text="关于"/>
    </Menu>
  )
}
