import { invoke } from "@tauri-apps/api"
import { useCallback, useEffect, useState, useMemo } from "react"
import { appWindow } from "@tauri-apps/api/window"

console.log("User Agent: ", navigator.userAgent)

export function useOS() {
  return useMemo(()=> {
    const ua = navigator.userAgent.toLocaleLowerCase()
    return {
      isMacOS: ua.indexOf("mac") != -1,
      isWindows: ua.indexOf("win") != -1,
      isLinux: ua.indexOf("linux") != -1,
    }
  }, [])
}

/** a strict lua ipc hook
 * error will auto emit to window
 */
export function useLuaCall(api, fn, defaultParams = {}, deps = []) {
  return useCallback((param={})=> {
    console.log({...defaultParams, ...param})
    invoke("lua_call", { api, param: JSON.stringify({...defaultParams, ...param}) }).then(
      response=> fn(response),
      error=> appWindow.emit("lua_call_error", error)
    )
  }, deps)
}

/** an unstrict lua ipc hook 
 * error will print to console
*/
export function useLuaCallLax(api, fn, defaultParams = {}, deps = []) {
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
    console.log(result)
    if (result === "true")
      onSuccess()
    else if (result === "DYN_ENCRYPT")
      appWindow.emit("alert", {
        icon: "disable",
        title: "提示",
        message: "这是一个加密的皮肤材质，无法拷贝或保存。",
      })
  }
  return fn
}

/** copy tex element to clipborad
 * need `xml` and `tex`
 */
export function useCopyTexElement(xml, tex) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "image", xml, tex, format: "copy"},
    [xml, tex])
  return fn
}

/** copy atlas to clipborad
 * need `build` and `sampler`
 */
export function useCopyBuildAtlas(build) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "atlas", build, format: "copy"},
    [build])
  return fn
}

/** copy symbol element to clipborad 
 * need `build` and `imghash` and `index`
*/
export function useCopySymbolElement(build) {
  const onCopy = useGenericHandleImageCopy()
  const fn = useLuaCall("load", onCopy, {type: "symbol_element", build, format: "copy"},
    [build])
  return fn
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