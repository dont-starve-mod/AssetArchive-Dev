import { invoke } from "@tauri-apps/api/core"
import { useCallback, useEffect, useState, useMemo, useRef } from "react"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { open, save } from "@tauri-apps/plugin-dialog"
import type { AppSettings } from "./redux/reducers/appsettings"
import { update as UpdateSetting } from "./redux/reducers/appsettings"
import { update as UpdateLocal } from "./redux/reducers/localstorage"
import store, { useDispatch, useSelector } from "./redux/store"
import { FmodPlayingInfo } from "./components/AppFmodHandler"
import { LocalStorage } from "./redux/reducers/localstorage"
import { useSearchParams } from "react-router-dom"
import { AppStates, setState } from "./redux/reducers/appstates"

/* eslint-disable */

const DYN_ENCRYPT = "DYN_ENCRYPT"

function checkEncryptResult(result: string | object){
  if (result === DYN_ENCRYPT){
    WebviewWindow.getCurrent().emit("alert", {
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
  }, [onMoveCb])
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
  },[onMouseMove, onMouseUp])
  
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
  }, [hover, lockGlobal])

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
  "ffmpeg_install" |
  "ffmpeg_uninstall" |
  "ffmpeg_custom_install" |
  "ffmpeg_getstate" |
  "render_animation_sync" | 
  "render_animation_async" |
  "quicklook_load" |
  "get_hash"
  
type LuaCallParams = {[K: string]: string | number | boolean | number[]}
type LuaCallCb<T> = (response: T, param?: any)=> void

/** a strict lua ipc hook
 * error will auto emit to window
 */
export function useLuaCall<T>(
  api: rLuaAPI, 
  callback: LuaCallCb<T>, 
  defaultParams: LuaCallParams = {}, 
  deps: React.DependencyList = [])
{
  return useCallback((param={})=> {
    // if ((defaultParams as any).debug){
    //   console.log("useLuaCall", {...defaultParams, ...param})
    // }
    invoke<T>("lua_call", { api, param: JSON.stringify({...defaultParams, ...param}) }).then(
      (response: T)=> callback(response, param),
      error=> WebviewWindow.getCurrent().emit("lua_call_error", error)
    )
  }, deps)
}

/** useLuaCall and call function on change */
export function useLuaCallOnce<T>(
  api: rLuaAPI, 
  callback: LuaCallCb<T>, 
  defaultParams: LuaCallParams = {}, 
  // dependency list that update the function definition (like useCallback)
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

export function useCopySuccess(type?: "image" | "path" | "code") {
  let message = (type === "image" ? "图片" : type === "path" ? "路径" : type === "code" ? "源代码" : "") 
    + "已拷贝至剪切板"
  return ()=> WebviewWindow.getCurrent().emit("toast", { message, icon: "endorsed", intent: "success"})
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
  const fn = useCallback(async (param?: LuaCallParams)=> {
    defaultPath = param?.defaultPath as string || defaultPath
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
export function useBatchDownloadDialog(type: "xml" | "build" | "fev_ref", data?: {[K in "file" | "build" | "path"]?: string}) {
  const call = useLuaCall("batch_download", ()=> {})
  
  const fn = useCallback(async ()=> {
    const dirpath = await open({
      directory: true,
      multiple: false,
      title: ""
    })
    call({type, ...data, target_dir: dirpath})
  }, [type, call])
  return fn
}

export function useSaveSuccess(type?: "image") {
  let message = (type === "image" ? "图片" : "") 
    + "保存成功"
  return (savepath: string)=> WebviewWindow.getCurrent().emit("toast", { message, icon: "saved", intent: "success", savepath})
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
export function useSaveFileCall(defaultParams: LuaCallParams, filters, defaultPath: string, deps: React.DependencyList) {
  const check_permission = defaultParams.check_permission === true
  const cb = useGenericSaveFileCb(filters) // callback fn when backend return message
  const saveFn = useLuaCall("load", cb, {...defaultParams, format: "save", result_type: "string"}, deps) // backend query
  const dialog = useSaveFileDialog(saveFn, filters, defaultPath) // get filepath from frontend 
  return useCallback(async (param?: LuaCallParams)=> {
    if (check_permission) {
      try {
        const result = await invoke<string>("lua_call", {api: "load", param: JSON.stringify({...defaultParams, ...param, format: "permission"})})
        if (checkEncryptResult(result)) return
      }
      catch(error) {
        WebviewWindow.getCurrent().emit("lua_call_error", error)
      }
    }
    await dialog(param)
  }, [check_permission, dialog])
}

/** appsettings getter & setter */
export function useAppSetting<K extends keyof AppSettings>(key: K):
[AppSettings[K], (v: AppSettings[K])=> void]
{
  const value = useSelector(({appsettings})=> appsettings[key])
  const dispatch = useDispatch()
  const call = useLuaCall("set", ()=> {}, {key}, [key])
  const set = (value: AppSettings[K])=> {
    dispatch(UpdateSetting({key, value})) 
    call({value})
  }
  return [ value, set ]
}

/** appstates getter & setter */
export function useAppStates<K extends keyof AppStates>(key: K):
[AppStates[K], (v: AppStates[K])=> void]
{
  const value = useSelector(({appstates})=> appstates[key])
  const dispatch = useDispatch()
  const set = (value: AppStates[K])=> {
    dispatch(setState({key, value}))
  }
  return [ value, set ]
}

/** localstorage getter & setter */
export function useLocalStorage<K extends keyof LocalStorage>(key: K):
[LocalStorage[K], React.Dispatch<LocalStorage[K]>]
{
  const value = useSelector(({localstorage})=> localstorage[key])
  const dispatch = useDispatch()
  const set = useCallback((value: LocalStorage[K])=> {
    dispatch(UpdateLocal({key, value}))
  }, [])

  return [ value, set ]
}

/** shared localstorage getter & setter */
export function useSharedLocalStorage<K extends keyof LocalStorage>(key: K):
[LocalStorage[K], React.Dispatch<LocalStorage[K]>]
{
  const [value, setValue] = useState(()=> store.getState().localstorage[key])
  const dispatch = useDispatch()
  const set = useCallback((value: LocalStorage[K])=> {
    setValue(value)
    dispatch(UpdateLocal({key, value}))
  }, [])

  return [value, set]
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

    if (ref.current) observer.observe(ref.current)
    return () => {
      if (ref.current) observer.unobserve(ref.current)
    }
  }, [ref, threshold, rootMargin])

  return { visible, appeared }
}

// dragger utils 
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

// page utils
type PageOptions = {
  numItemsPerPage?: number,
  resetScroll?: ()=> void,
}
export function usePagingHandler<T>(items: Array<T>, options?: PageOptions) {
  const {numItemsPerPage = 100, resetScroll} = options || {}
  const [page, setPage] = useState(0)
  const totalPage = Math.ceil(items.length / numItemsPerPage)
  const clampedPage = Math.max(0, Math.min(page, totalPage - 1))
  const range = [clampedPage* numItemsPerPage, (clampedPage + 1)* numItemsPerPage - 1]
  const next = useCallback(()=> {
    setPage(Math.min(totalPage - 1, clampedPage + 1))
    resetScroll?.()
  }, [clampedPage, totalPage, resetScroll])
  const prev = useCallback(()=> {
    setPage(Math.max(0, clampedPage - 1))
    resetScroll?.()
  }, [clampedPage, resetScroll])
  const first = useCallback(()=> {
    setPage(0)
    resetScroll?.()
  }, [resetScroll])
  const last  = useCallback(()=> {
    setPage(Math.max(totalPage - 1, 0))
    resetScroll?.()
  }, [totalPage, resetScroll])

  return {
    prev, next, first, last, page: clampedPage, totalPage, range
  }
}