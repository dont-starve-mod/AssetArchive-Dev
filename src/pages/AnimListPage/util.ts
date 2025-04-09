import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { v5 as uuidv5 } from 'uuid'

const uuidNS = uuidv5("AnimProject", uuidv5.URL)

export async function openAnimSubwindow({id}: {id: string}) {
  const label = uuidv5(id, uuidNS)
  let subwindow = await WebviewWindow.getByLabel(label)
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
      dragDropEnabled: false,
    })
    subwindow.once("tauri://error", (e)=> window.emit("alert", {
      title: "警告", 
      message: "无法创建窗口 - " + label + " \n" + e.payload
    }))
  }
}