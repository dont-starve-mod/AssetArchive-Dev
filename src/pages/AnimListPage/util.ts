import { appWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/window"
import { v5 as uuidv5 } from 'uuid'

const uuidNS = uuidv5("Asset Archive", uuidv5.URL)

export function openAnimSubwindow({id}: {id: string}) {
  const label = uuidv5(id, uuidNS)
  if (WebviewWindow.getByLabel(label)) {
    console.log(`Window <${id}> - ${label} is open, skip`)
  }
  else {
    const w = new WebviewWindow(label, {
      title: "Anim Renderer",
      url: "/anim/" + encodeURIComponent(id).replace(".", "%2E"),
      minWidth: 700,
      minHeight: 500,
      fileDropEnabled: false,
    })
    // w.once("tauri://created", (e)=> console.log(e))
    w.once("tauri://error", (e)=> appWindow.emit("alert", {
      title: "警告", 
      message: "无法创建窗口 - " + label + " \n" + e.payload
    }))
  }
}