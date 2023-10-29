import { appWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/window"
import { v5 as uuidv5 } from 'uuid'

const uuidNS = uuidv5("Asset Archive", uuidv5.URL)

export function openAnimSubwindow({id}: {id: string}) {
  const label = uuidv5(id, uuidNS)
  let subwindow = WebviewWindow.getByLabel(label)
  if (subwindow) {
    console.log(`Window <${id}> - ${label} is open`)
    subwindow.setFocus()
  }
  else {
    subwindow = new WebviewWindow(label, {
      title: "Anim Renderer",
      url: "/anim/" + encodeURIComponent(id).replace(".", "%2E"),
      minWidth: 700,
      minHeight: 500,
      fileDropEnabled: false,
    })
    subwindow.once("tauri://error", (e)=> appWindow.emit("alert", {
      title: "警告", 
      message: "无法创建窗口 - " + label + " \n" + e.payload
    }))
  }
}