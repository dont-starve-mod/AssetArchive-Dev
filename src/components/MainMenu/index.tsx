import React, { useCallback, useEffect, useState } from 'react'
import { Menu, MenuDivider, MenuItem, IconName } from '@blueprintjs/core'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppSetting } from '../../hooks'
import { invoke } from '@tauri-apps/api'

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
  }, [root, to, redirectNoRoot])
  return <MenuItem
    icon={icon}
    text={text}
    onClick={onClick}
    intent={path.indexOf(to) != -1 ? "primary" : "none"}
  />
}

export default function MainMenu() {
  const [isDebug, setIsDebug] = useState(false)
  useEffect(()=> {
    invoke<boolean>("get_is_debug").then(setIsDebug)
  }, [])

  return <Menu style={{minWidth: "100%", backgroundColor: "transparent"}}>
    <MenuNavLink icon="git-repo" to="/asset-group" text="游戏资源" redirectNoRoot/>
    <MenuNavLink icon="walk" to="/anim-list" text="动画渲染器" redirectNoRoot/>
    {/* <div onClick={()=> alert("这个功能还没做完 _(:з」∠)_")}><MenuNavLink icon="color-fill" to="/filter" text="滤镜渲染器" /></div> */}
    {/* <MenuNavLink icon="build" to="/modtools" text="模组工具" /> */}
    {/* <MenuNavLink icon="bug" to="/about#bug" text="反馈bug" /> */}
    <MenuDivider />
    {
      isDebug && <MenuItem icon="bug" text="Debug">
        <MenuItem text="刷新" onClick={()=> location.href = location.href}/>
        <MenuItem text="重载Lua" onClick={()=> invoke("lua_reload").then(
          // ()=> location.href = location.href,
          ()=> {},
          error=> window.alert("Failed to reload:\n" + error)
        )}/>
      </MenuItem>
    }
    <MenuNavLink icon="cog" to="/settings" text="设置"/>
    <MenuNavLink icon="heart" to="/about" text="关于"/>
    {/* <MenuItem text="Settings..." icon="cog" intent="primary" >
      <MenuItem icon="tick" text="Save on edit" />
      <MenuItem icon="blank" text="Compile on edit" />
    </MenuItem> */}
  </Menu>
}
