import { Card, H3, H5 } from '@blueprintjs/core'
import React from 'react'
import { appWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/window'

type ModToolProps = {
  title: string,
  desc: string,
  bin: "maketex" | "makecc" | "lockanim",
}

function openToolSubwindow(title: string, bin: string) {
  const label = "modtool-" + bin
  let subwindow = WebviewWindow.getByLabel(label)
  if (subwindow) {
    console.log(`Window ${label} is open`)
    subwindow.setFocus()
  }
  else {
    subwindow = new WebviewWindow(label, {
      title,
      url: "/tool/" + encodeURIComponent(bin),
      // minWidth: 700,
      // minHeight: 500,
      fileDropEnabled: true,
    })
    subwindow.once("tauri://error", (e)=> appWindow.emit("alert", {
      title: "警告", 
      message: "无法创建窗口 - " + label + " \n" + e.payload
    }))
  }
}

function ModTool(props: ModToolProps) {
  const { title, bin, desc } = props
  return (
    <Card onClick={()=> openToolSubwindow(title, bin)}>
      <H5>{title}</H5>
      <p>{desc}</p>
    </Card>
  )
}
export default function ModToolsPage() {
  return (
    <div>
      <H3>模组工具箱</H3>
      <ModTool title="制作贴图" desc="将一张或多张图片打包成一个tex。" bin="maketex"/>
      <ModTool title="动画上锁" desc="防止你的动画资源包被解压和反编译。" bin="lockanim"/>
    </div>
  )
}
