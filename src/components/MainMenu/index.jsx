import React from 'react'
import { Menu, Button, MenuDivider, MenuItem } from '@blueprintjs/core'
import { useLocation, useNavigate } from 'react-router-dom'

function MenuNavLink(props) {
  const navigate = useNavigate()
  const path = useLocation().pathname

  const { icon, text, to } = props
  return <MenuItem
    icon={icon}
    text={text}
    onClick={()=> navigate(to)}
    intent={path.indexOf(to) != -1 ? "primary" : "none"}
  />
}

export default function MainMenu() {
  return <Menu style={{minWidth: "100%", backgroundColor: "transparent"}}>
    <MenuNavLink icon="git-repo" to="/assets" text="游戏资源" />
    <MenuNavLink icon="walk" to="/anim-player" text="动画渲染器" />
    <MenuNavLink icon="color-fill" to="/filter" text="滤镜效果" />
    <MenuNavLink icon="build" to="/modtools" text="模组工具" />
    <MenuNavLink icon="bug" to="/report-bug" text="反馈bug" />
    <MenuDivider />

    <MenuNavLink icon="cog" to="/settings" text="设置"/>
    <MenuNavLink icon="heart" to="/about" text="关于"/>
    {/* <MenuItem text="Settings..." icon="cog" intent="primary" >
      <MenuItem icon="tick" text="Save on edit" />
      <MenuItem icon="blank" text="Compile on edit" />
    </MenuItem> */}
  </Menu>
}