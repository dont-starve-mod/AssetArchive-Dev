import React from 'react'
import { writeText } from '@tauri-apps/api/clipboard'
import { Icon } from '@blueprintjs/core'
export default function Footer() {
  const currentURL = location.toString().replace("tauri://", "")
  const copyURL = ()=> {
    writeText(currentURL).then(
      ()=> window.alert("已拷贝至剪贴板"),
      e=> window.alert("拷贝失败: " + e.message)
    )
  }
  const currentVersion = "0.0.0 - alpha"
  const copyVersion = ()=> {
    writeText(currentVersion).then(
      ()=> window.alert("已拷贝至剪贴板"),
      e=> window.alert("拷贝失败: " + e.message)
    )
  }
  return (<>
    <div>
      <div>
        <a className='bp4-monospace-text' onClick={copyVersion}>
          <Icon icon="git-branch"/>
          &nbsp;
          {currentVersion}
        </a>
      </div>
    </div>
    <div>
      <div>
        <a className='bp4-monospace-text' onClick={copyURL}>
          当前路径: {location.toString().replace("tauri://", "")}
        </a>
      </div>
    </div>
  </>)
}
