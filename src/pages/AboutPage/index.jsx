import React from 'react'
import { H1, H2, H3, H4, Button } from "@blueprintjs/core"
import { appWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/window'
import Preview from '../../components/Preview'

export default function About() {
  const newWindow = ()=> {
    const window = new WebviewWindow("theUniqueLabel", {
      url: "index.html"
    })
    window.once("tauri://created", function(){
      console.log("Create!!!!!!")
    })
  }

  
  return (<>
    <Button onClick={()=> newWindow()}>测试按钮</Button>
    <Preview width={400} height={400}/>
  </>)
}
