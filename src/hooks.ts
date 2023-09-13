import { invoke } from "@tauri-apps/api"
import { useCallback, useEffect, useState, useMemo, useRef } from "react"
import { appWindow } from "@tauri-apps/api/window"
import { save } from "@tauri-apps/api/dialog"

console.log("User Agent: ", navigator.userAgent)

const DYN_ENCRYPT = "DYN_ENCRYPT"

function checkEncryptResult(result: string | object){
  if (result === DYN_ENCRYPT){
    appWindow.emit("alert", {
      icon: "disable",
      title: "提示",
      message: "这是一个加密的皮肤材质，无法拷贝或保存。",
    })
  }
  return result === DYN_ENCRYPT
}

export function useOS() {
  return useMemo(()=> {
    const ua = navigator.userAgent.toLocaleLowerCase()
    return {
      isMacOS: ua.indexOf("mac") !== -1,
      isWindows: ua.indexOf("win") !== -1,
      isLinux: ua.indexOf("linux") !== -1,
    }
  }, [])
}

export function useMouseDrag(onMoveCb: (x: number, y: number, px: number, py: number)=> void) {
  const down = useRef(false)
  const onMouseMove = useCallback((e: MouseEvent)=> {
    if (down.current){
      const {movementX: x, movementY: y, clientX: px, clientY: py} = e
      onMoveCb(x, y, px, py)
    }
  }, [])
  const onMouseUp = useCallback(()=> {
    down.current = false
  }, [])
  useEffect(()=> {
    document.addEventListener<"mousemove">("mousemove", onMouseMove)
    document.addEventListener<"mouseup">("mouseup", onMouseUp)
    return ()=> {
      document.removeEventListener<"mousemove">("mousemove", onMouseMove)
      document.removeEventListener<"mouseup">("mouseup", onMouseUp)
    }
  },[])
  const onMouseDown = ()=> {
    down.current = true
  }
  return [onMouseDown]
}

export function useMouseScroll(onScrollCb: (y: number)=> void, lockGlobal = true):
[(e: React.WheelEvent)=> void, (e: React.MouseEvent)=> void, (e: React.MouseEvent)=> void]
{
  const [hover, setHover] = useState(false)
  const onScroll = useCallback((e: React.WheelEvent)=> {
    onScrollCb(e.deltaY)
  }, [])

  const onMouseEnter = useCallback(()=> setHover(true), [])
  const onMouseLeave = useCallback(()=> setHover(false), [])

  useEffect(()=> {
    if (!lockGlobal) return ()=> {} /* do nothing */

    const nodes = [
      document.getElementById("app-article") as HTMLElement, // article
       document.getElementsByTagName("body")[0], // body
    ]
// @ts-ignore 
    nodes.forEach(({style})=> style.overflow = hover ? "hidden" : null)
// @ts-ignore 
    return ()=> nodes.forEach(({style})=> style.overflow = null)
  }, [hover])

  return [onScroll, onMouseEnter, onMouseLeave]
}

/** a strict lua ipc hook
 * error will auto emit to window
 */
type rLuaAPI = "appinit" | "load" | "setroot" | "copy" | "animproject" | "setconfig" | "getconfig"
export function useLuaCall<T>(api: rLuaAPI, fn, defaultParams = {}, deps: any[] = []) {
  return useCallback((param={})=> {
    if ((defaultParams as any).debug){
      console.log("useLuaCall", {...defaultParams, ...param})
    }
    invoke<T>("lua_call", { api, param: JSON.stringify({...defaultParams, ...param}) }).then(
      (response: T)=> fn(response),
      error=> appWindow.emit("lua_call_error", error)
    )
  }, deps)
}

/** an unstrict lua ipc hook 
 * error will print to console
*/
export function useLuaCallLax(api: rLuaAPI, fn, defaultParams = {}, deps = []) {
  return useCallback((param={})=> {
    invoke("lua_call", { api, param: JSON.stringify({...defaultParams, ...param}) }).then(
      response=> fn(response),
      console.warn,
    )
  }, deps)
}

export function useCopySuccess(type) {
  let message = (type === "image" ? "图片" : "") 
    + "已拷贝至剪切板"
  return ()=> appWindow.emit("toast", { message, icon: "endorsed", intent: "success"})
}

export function useGenericHandleImageCopy() {
  const onSuccess = useCopySuccess("image")
  const fn = result=> {
    if (!checkEncryptResult(result)){
      if (result === "true") onSuccess()
    }
  }
  return fn
}

/** copy tex element to clipborad
 * need `xml` and `tex`
 */
export function useCopyTexElement(xml: string, tex: string) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "image", xml, tex, format: "copy"},
    [xml, tex])
  return fn
}

/** copy atlas to clipborad
 * need `build` and `sampler`
 */
export function useCopyBuildAtlas(build: string) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "atlas", build, format: "copy"},
    [build])
  return fn
}

/** copy texture to clipboard
 * need `file`
 */
export function useCopyTexture(file: string) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "texture", file, format: "copy"},
    [file])
  return fn
}

/** copy symbol element to clipborad 
 * need `build` and `imghash` and `index`
*/
export function useCopySymbolElement(build: string) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "symbol_element", build, format: "copy"},
    [build])
  return fn
}

const SAVE_FILTERS = {
  IMAGE: [
    {name: "Image", extensions: ["png"]}
  ],
}

/** common file save dialog */
export function useSaveFileDialog(saveFn, filters, defaultPath?: string) {
  const fn = useCallback(async ()=> {
    const filepath = await save({
      filters: typeof filters === "string" ? SAVE_FILTERS[filters.toUpperCase()] : filters,
      defaultPath,
    })
    if (filepath)
      saveFn({path: filepath})
  }, [saveFn])
  return fn
}

export function useSaveSuccess(type) {
  let message = (type === "image" ? "图片" : "") 
    + "保存成功"
  return (savepath)=> appWindow.emit("toast", { message, icon: "saved", intent: "success", savepath})
}

export function useGenericSaveFileCb(filters) {
  let type = filters // alias
  const onSuccess = useSaveSuccess(type)
  const fn = result=> {
    if (!checkEncryptResult(result)){
      onSuccess(result)
    }
  }
  return fn
}

/** wrap `useSaveFile` and `useLuaCall` */
export function useSaveFileCall({api = "load", defaultParams, deps, filters, defaultPath}) {
  const cb = useGenericSaveFileCb(filters) // callback fn when backend return message
  const saveFn = useLuaCall(api, cb, defaultParams, deps) // backend query
  const dialog = useSaveFileDialog(saveFn, filters, defaultPath) // get filepath from frontend 
  return dialog
}

/** basic config getter&setter */
export function useConfig(key, onGet = ()=>{}, onSet = ()=>{}) {
  const getCall = useLuaCall("getconfig", onGet, {key})
  const setCall = useLuaCall("setconfig", onSet, {key})
  return [getCall, setCall]
}

/** a observer to test if widget is into view */
export function useIntersectionObserver({ref, threshold = 0, rootMargin = "100px"}) {
  const [visible, setVisible] = useState(false)
  const [appeared, setAppeared] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(entry=> {
      setVisible(entry[0].isIntersecting)
      if (entry[0].isIntersecting && !visible){
        setAppeared(true)
      }
    }, { rootMargin, threshold })
    observer.observe(ref.current)
    return () => ref.current && observer.unobserve(ref.current)
  }, [ref, visible, threshold, rootMargin])

  return { visible, appeared }
}