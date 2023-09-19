import React, { useEffect, useState } from 'react'
import { writeText } from '@tauri-apps/api/clipboard'
import { getVersion } from '@tauri-apps/api/app'
import { Icon } from '@blueprintjs/core'

const BRANCH = "alpha"

export default function Footer() {
  const currentURL = location.toString().replace("tauri://", "")
  const copyURL = ()=> {
    writeText(currentURL).then(
      ()=> window.alert("已拷贝至剪贴板"),
      e=> window.alert("拷贝失败: " + e.message)
    )
  }
  const [version, setVersion] = useState("")

  useEffect(()=> {
    getVersion().then(v=> setVersion(BRANCH + " - " + v))
  }, [])

  const copyVersion = ()=> {
    writeText(version).then(
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
          {version}
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
