import React, { useRef } from 'react'
import { H1, H2, H3, H4, Button } from "@blueprintjs/core"
import { appWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/window'
import Preview from '../../components/Preview'

const canvas = document.createElement("canvas");
canvas.width = canvas.height = 50;

const ctx = canvas.getContext("2d");
ctx.lineWidth = 4;
ctx.moveTo(0, 0);
ctx.lineTo(50, 50);
ctx.moveTo(0, 50);
ctx.lineTo(50, 0);
ctx.stroke();

function dragWithCustomImage(event) {

  const dt = event.dataTransfer;
  dt.setDragImage(canvas, 25, 25);
}

export default function About() {
  const newWindow = ()=> {
    const window = new WebviewWindow("theUniqueLabel", {
      url: "/anim"
    })
    window.once("tauri://created", function(){
      console.log("Create!!!!!!")
    })
  }
  const ref = useRef()
  
  return (<>
    <div style={{width: 100, height: 100, backgroundColor: "pink"}} 
    onDragEnter={(e)=> {e.preventDefault(); console.log("ENTER", e.dataTransfer.getData("text/plain")); e.preventDefault()}}
    // onDragOver={(e)=> console.log("OVER", e, performance.now())}
    onDrag={(e)=> console.log("Drag", e)}
    onDrop={(e)=> console.log("Drop!!!!!", e)}
    >
      这里应该响应拖拽
    </div>
    <p draggable="true" onDragStart={(e)=> {
      e.dataTransfer.setData("text/plain", ref.current.value)
      console.log("Drag--->", e.dataTransfer)
      console.log(e.dataTransfer.getData("text"))
      dragWithCustomImage(e)
    }
  } onDragEnd={()=> console.log("END!!!")}>
      这里自定义内容
      <input placeholder='输入...' ref={ref}></input>义内
    </p>
    <Button onClick={()=> newWindow()}>测试按钮</Button>
    {/* <Preview width={400} height={400}/> */}
  </>)
}
