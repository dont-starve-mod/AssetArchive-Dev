import { appWindow } from "@tauri-apps/api/window"
import { WebviewWindow } from "@tauri-apps/api/window"
import { v5 as uuidv5 } from 'uuid'

const uuidNS = uuidv5("Asset Archive", uuidv5.URL)

export function openAnimSubwindow({id}: {id: string}) {
  const label = uuidv5(id, uuidNS)
  console.log("Create window with label: ", label)
  if (WebviewWindow.getByLabel(label)) {
    console.log(`Window <${id}> - ${label} is open, skip`)
  }
  else {
    const w = new WebviewWindow(label, {
      // tabbingIdentifier: "anim",
      url: "/anim/" + encodeURIComponent(id),
      minWidth: 400,
      minHeight: 300,
      fileDropEnabled: false,
    })
    // w.once("tauri://created", (e)=> console.log(e))
    w.once("tauri://error", (e)=> appWindow.emit("alert", {
      title: "警告", 
      message: "无法创建窗口 - " + label + " \n" + e.payload
    }))
  }
}