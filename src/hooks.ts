import { invoke } from "@tauri-apps/api"
import { useCallback, useEffect, useState, useMemo, useRef } from "react"
import { appWindow } from "@tauri-apps/api/window"
import { open, save } from "@tauri-apps/api/dialog"
import type { AppSettings } from "./redux/reducers/appsettings"
import { update as UpdateSetting, update } from "./redux/reducers/appsettings"
import { useDispatch, useSelector } from "./redux/store"

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
    // console.log("User Agent: ", ua)
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

export function useMouseScroll(onScrollCb: (y: number, e?: React.WheelEvent)=> void, lockGlobal = true):
[(e: React.WheelEvent)=> void, (e: React.MouseEvent)=> void, (e: React.MouseEvent)=> void]
{
  const [hover, setHover] = useState(false)
  const onScroll = useCallback((e: React.WheelEvent)=> {
    onScrollCb(e.deltaY, e)
  }, [onScrollCb])

  const onMouseEnter = useCallback(()=> setHover(true), [])
  const onMouseLeave = useCallback(()=> setHover(false), [])

  useEffect(()=> {
    if (!lockGlobal) return ()=> {} /* do nothing */

    const nodes = [
      document.getElementById("app-article") as HTMLElement, // article
      document.getElementsByTagName("body")[0], // body
    ].filter(node=> Boolean(node))
  
    nodes.forEach(({style})=> style.overflow = hover ? "hidden" : null)
    return ()=> nodes.forEach(({style})=> style.overflow = null)
  }, [hover])

  return [onScroll, onMouseEnter, onMouseLeave]
}

export function useMouseDragClick():
[(e: React.MouseEvent)=> void, (e: React.MouseEvent)=> void, ()=> boolean]
{
  const downPos = useRef([0, 0])
  const upPos = useRef([1000, 1000])
  const onMouseDown = useCallback((e: React.MouseEvent)=> {
    downPos.current = [e.clientX, e.clientY]
  }, [])
  const onMouseUp = useCallback((e: React.MouseEvent)=> {
    upPos.current = [e.clientX, e.clientY]
  }, [])
  const isDragClick = useCallback(()=> {
    return Math.max(
      Math.abs(upPos.current[0] - downPos.current[0]),
      Math.abs(upPos.current[1] - downPos.current[1])
    ) >= 4
  }, [])
  return [onMouseDown, onMouseUp, isDragClick]
}

type rLuaAPI = 
  "appinit" |
  "load" | 
  "setroot" | "showroot" | 
  "copy" | 
  "batch_download" |
  "animproject.init" | "animproject" | 
  "set" |
  "render_animation_sync" | 
  "render_animation_async"
  
type LuaCallCb<T> = (response: T, param?: any)=> void

/** a strict lua ipc hook
 * error will auto emit to window
 */
export function useLuaCall<T>(
  api: rLuaAPI, 
  callback: LuaCallCb<T>, 
  defaultParams = {}, 
  deps: React.DependencyList = [])
{
  return useCallback((param={})=> {
    // if ((defaultParams as any).debug){
      console.log("useLuaCall", {...defaultParams, ...param})
    // }
    invoke<T>("lua_call", { api, param: JSON.stringify({...defaultParams, ...param}) }).then(
      (response: T)=> callback(response, param),
      error=> appWindow.emit("lua_call_error", error)
    )
  }, deps)
}

/** useLuaCall and call function on change */
export function useLuaCallOnce<T>(
  api: rLuaAPI, 
  callback: LuaCallCb<T>, 
  defaultParams = {}, 
  // dependency list that change the function definition (like useCallback)
  deps: React.DependencyList,
  // dependency list that indicating whether the function will be called after changed
  // an empty list or a non-empty list containing true value is YES
  // a non-empty list containing no true value is NO
  filter_deps: React.DependencyList = [])
{
  const fn = useLuaCall<T>(api, callback, defaultParams, deps)
  useEffect(()=> {
    if (filter_deps.length === 0 || filter_deps.find(v=> Boolean(v)) !== undefined)
      fn()
  }, [fn, ...filter_deps])
}

/** an unstrict lua ipc hook 
 * error will print to console
*/
export function useLuaCallLax(api: rLuaAPI, fn, defaultParams = {}, deps: React.DependencyList = []) {
  return useCallback((param={})=> {
    invoke("lua_call", { api, param: JSON.stringify({...defaultParams, ...param}) }).then(
      response=> fn(response),
      console.warn,
    )
  }, deps)
}

export function useCopySuccess(type?: "image" | "path") {
  let message = (type === "image" ? "图片" : type === "path" ? "路径" : "") 
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
export function useSaveFileDialog(saveFn, filters, defaultPath: string) {
  const fn = useCallback(async (param?: {[K: string]: any})=> {
    defaultPath = param?.defaultPath || defaultPath
    if (filters === "image" && defaultPath.endsWith(".tex"))
      defaultPath = defaultPath.substring(0, defaultPath.length - 4) + ".png"
    
    const filepath = await save({
      filters: typeof filters === "string" ? SAVE_FILTERS[filters.toUpperCase()] : filters,
      defaultPath,
    })
    if (filepath)
      saveFn({...param, path: filepath})
  }, [saveFn])
  return fn
}

/** common batch save dialog */
export function useBatchDownloadDialog(type: "xml" | "build", data?: {[K in "file" | "build"]?: string}) {
  const call = useLuaCall("batch_download", ()=> {})
  
  const fn = useCallback(async ()=> {
    const dirpath = await open({
      directory: true,
      multiple: false,
      title: ""
    })
    call({type, ...data, target_dir: dirpath})
  }, [call])
  return fn
}

export function useSaveSuccess(type) {
  let message = (type === "image" ? "图片" : "") 
    + "保存成功"
  return (savepath: string)=> appWindow.emit("toast", { message, icon: "saved", intent: "success", savepath})
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
export function useSaveFileCall(defaultParams, filters, defaultPath: string, deps: React.DependencyList) {
  const cb = useGenericSaveFileCb(filters) // callback fn when backend return message
  const saveFn = useLuaCall("load", cb, {...defaultParams, format: "save", result_type: "string"}, deps) // backend query
  const dialog = useSaveFileDialog(saveFn, filters, defaultPath) // get filepath from frontend 
  return dialog
}

/** appsettings getter & setter */
export function useAppSetting<K extends keyof AppSettings>(key: K):
[AppSettings[K], (v: AppSettings[K])=> void]
{
  const appsettings = useSelector(({appsettings})=> appsettings)
  const dispatch = useDispatch()
  
  const value = appsettings[key]
  const call = useLuaCall("set", ()=> {}, {key}, [key])
  const set = (v: AppSettings[K])=> {
    dispatch(UpdateSetting({key: key, value: v})) 
    call({value: v})
  }
  return [ value, set ]
}

/** a observer to test if widget is into view */
export function useIntersectionObserver(param: {ref: React.MutableRefObject<HTMLElement>} & IntersectionObserverInit){
  const {ref, threshold = 0, rootMargin = "40px"} = param
  const [visible, setVisible] = useState(false)
  const [appeared, setAppeared] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(entry=> {
      setVisible(entry[0].isIntersecting)
      if (entry[0].isIntersecting){
        setAppeared(true)
      }
    }, { rootMargin, threshold })
    observer.observe(ref.current)
    return () => ref.current && observer.unobserve(ref.current)
  }, [ref, threshold, rootMargin])

  return { visible, appeared }
}

/** dragger utils */
type dragDataKey = "source" | "payload"
const getDragData = async (key: dragDataKey)=> {
  return invoke<string>("get_drag_data", { key })
}

const setDragData = async (key: dragDataKey, value: string)=> {
  return invoke("set_drag_data", { key, value })
}

const clearDragData = async ()=> {
  return invoke("clear_drag_data")
}

export function useDragData() {
  return {
    get: getDragData, 
    set: setDragData,
    clear: clearDragData,
  }
}