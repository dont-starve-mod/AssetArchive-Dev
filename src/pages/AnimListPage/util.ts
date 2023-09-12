import { appWindow } from "@tauri-apps/api/window"
import { WebviewWindow, getAll, getCurrent } from "@tauri-apps/api/window"

export function openAnimSubwindow({id}: {id: string}) {
  const label = "ANIM/" + id + performance.now()
  if (WebviewWindow.getByLabel(label)) {
    console.log("Window<" + label + "> is open, skip")
  }
  else {
    const w = new WebviewWindow(label, {
      // tabbingIdentifier: "anim",
      url: "/anim/" + encodeURIComponent(label),
      minWidth: 400,
      minHeight: 300,
    })
    w.once("tauri://created", (e)=> console.log(e))
    w.once("tauri://error", (e)=> appWindow.emit("alert", {
      title: "警告", 
      message: "无法创建窗口<" + label + ">\n" + e.payload
    }))
  }
}