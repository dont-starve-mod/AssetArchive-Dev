import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import { writeText } from '@tauri-apps/api/clipboard'
import { appWindow } from '@tauri-apps/api/window'
import { listen as globalListen, once as globalListenOnce } from '@tauri-apps/api/event'
import { Alert, H3 } from '@blueprintjs/core'
import GameRootSetter from '../GameRootSetter'
import worker from '../../searchengine_worker'

window.config = {}
window.assets = {}
window.assets_map = {}
window.hash = new Map()

export default function AppInit() {
  const [root, setRoot] = useState(".")
  useEffect(()=> {
    async function init() {
      try{
        const handlers = [
          await globalListenOnce("allconfig", ({payload})=> {
            const config = JSON.parse(payload)
            Object.keys(config).forEach(k=> window.config[k] = config[k]) 
            if (config.colortheme) {
              appWindow.emit("colortheme", config.colortheme)
            }
          }),
          await globalListenOnce("assets", ({payload})=> {
            const assets = JSON.parse(payload)
            window.assets = assets
            window.assets_map = {}
            Object.values(assets).forEach(list=> {
              list.forEach(a=> window.assets_map[a.id] = a)
            })
            worker.postMessage({assets})
          }),
          await globalListenOnce("hashmap", ({payload})=> {
            JSON.parse(payload).forEach(([k,v])=> {
              window.hash.set(v, k)
            })
          }),
          await globalListenOnce("root", ({payload: path})=> {
            setRoot(path)
            if (path.length === 0) {
              // failed
              console.log("no root found")
            }
          })
        ]
        await invoke("app_init")
        return handlers
      }
      catch(error) {
        if (error.message === "window.__TAURI_IPC__ is not a function") {
          return
        }
        else {
          appWindow.emit("lua_init_error", error)
        }
      }
    }
    let handlers = init()
    console.log(handlers)
    return ()=> handlers.then(fns=> fns.forEach(f=> f()))
  }, [])

  useEffect(()=> {
    let unlisten = globalListen("updateconfig", ({payload})=> {
      // console.log("updateconfig", payload)
      const {key, value} = JSON.parse(payload)
      window.config[key] = value
    })
    return ()=> unlisten.then(f=> f())
  }, [])

  return <>
    <ErrorHandler/>
    <GameRootSetter isOpen={root.length === 0}/>
  </>
}

function ErrorHandler(){
  const [initError, setInitError] = useState()
  const [luaError, setLuaError] = useState()
  const [alert, setAlertData] = useState({})

  useEffect(()=> {
    let unlisten = appWindow.listen("lua_init_error", (event)=> {
      setInitError(event.payload)
    })
    return ()=> unlisten.then(f=> f())
  }, [])

  useEffect(()=> {
    let unlisten = appWindow.listen("lua_call_error", (event)=> {
      console.error(event.payload)
      setLuaError(event.payload)
    })
    return ()=> unlisten.then(f=> f())
  }, [])

  useEffect(()=> {
    let unlisten = appWindow.listen("alert", ({payload})=> {
      console.warn(payload)
      payload.isOpen = true // force set
      setAlertData(payload)
    })
    return ()=> unlisten.then(f=> f())
  }, [])

  const copyErrorMessage = e=> {
    console.log(e)
    writeText(initError || luaError /* a tricky impl */).then(
      ()=> window.alert("已将错误信息拷贝到剪贴板"),
      e=> window.alert(e.message)
    )
  }

  return <>
    <Alert
      icon="warning-sign"
      isOpen={Boolean(initError)}
      intent="danger"
      cancelButtonText="错误信息"
      onCancel={copyErrorMessage}
      confirmButtonText="退出"
      onConfirm={()=> appWindow.close()}
      style={{maxWidth: 500, width: 500}}
      >
        <H3>很抱歉，程序出现致命错误</H3>
        <pre className='bp4-code-block' style={{
          maxWidth: 380,
          maxHeight: 200,
          overflow: "auto",
        }}>
          <code>{initError}</code>
          </pre>
        <br/>
        <p>如果反复出现该问题，请向作者反馈。</p>
    </Alert>
    <Alert
      icon="warning-sign"
      isOpen={Boolean(luaError)}
      intent="warning"
      cancelButtonText="错误信息"
      onCancel={copyErrorMessage}
      confirmButtonText="好的"
      onConfirm={()=> setLuaError()}
      style={{maxWidth: 500, width: 500}}
      >
        <H3>很抱歉，程序出现错误</H3>
        <pre className='bp4-code-block' style={{
          maxWidth: 380,
          maxHeight: 200,
          overflow: "auto"
        }}>
          <code>{luaError}</code>
        </pre>
        <p>如果反复出现该问题，请向作者反馈。</p>
    </Alert>
    <Alert
      icon={alert.icon}
      isOpen={alert.isOpen}
      intent={alert.intent || 'warning' }
      confirmButtonText="好的"
      onConfirm={()=> setAlertData({})}
      onCancel={()=> setAlertData({})}
      canEscapeKeyCancel={true}
      canOutsideClickCancel={true}
      style={{maxWidth: 500, width: 500}}
    >
      <H3>{alert.title}</H3>
      <p>{alert.message}</p>
    </Alert>
  </>
}
