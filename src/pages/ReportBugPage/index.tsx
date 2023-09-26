import React from 'react'
import { H3 } from '@blueprintjs/core'
import { open } from '@tauri-apps/api/shell'

export default function ReportBug() {
  return (
    <div>
      <H3>饥荒资源档案 - <span className='bp4-monospace-text'>alpha</span></H3>
      <p>该版本为预览版本，处于活跃更新状态，暂不接受bug反馈，敬请理解。</p>
      <p>B站关注<a onClick={()=> open("https://space.bilibili.com/209631439")}>@老王天天写bug</a>，获取最新更新动态。</p>
    </div>
  )
}