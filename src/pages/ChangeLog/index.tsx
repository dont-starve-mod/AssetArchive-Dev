import { H3, H5, UL } from '@blueprintjs/core'
import { WebviewWindow } from '@tauri-apps/api/window'
import React from 'react'

export default function ChangeLog() {
  return (
    <div className="p-5 bp4-running-text">
      <H5>alpha - 0.0.5</H5>
      <UL>
        <li>修复加载包含非法animation/build/hash字符串的资源时引起的报错。</li>
        <li>新增动画预设中的人物模型选项。</li>
      </UL>
    </div>
  )
}

export function openChangeLog() {
  let label = "change-log"
  let subwindow = WebviewWindow.getByLabel(label)
  if (subwindow)
    subwindow.setFocus().then(console.log, console.error)
  else
    new WebviewWindow(label, {
      title: "",
      url: "/change-log",
      width: 600,
      height: 800,
      resizable: true,
    })
}