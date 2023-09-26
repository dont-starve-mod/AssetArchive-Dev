import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import { writeText } from '@tauri-apps/api/clipboard'
import { appWindow } from '@tauri-apps/api/window'
import { listen as globalListen, once as globalListenOnce } from '@tauri-apps/api/event'
import { Alert, AlertProps, H3 } from '@blueprintjs/core'
import GameRootSetter from '../GameRootSetter'
import { searchengine } from '../../asyncsearcher'
import { useDispatch, useSelector } from '../../redux/store'
import { AppSettings, init as initSettings, update as updateSetting } from '../../redux/reducers/appsettings'
import { AllAssetTypes } from '../../searchengine'

window.assets = {}
window.assets_map = {}
window.hash = new Map()

export default function AppInit() {
  const root = useSelector(({appsettings})=> appsettings.last_dst_root)
  const requestRoot = typeof root === "string" && root.length === 0
  
  const dispatch = useDispatch()

  useEffect(()=> {
    async function init() {
      const handlers = [
        await globalListen<string>("settings", ({payload})=> {
          const settings: AppSettings = JSON.parse(payload)
          console.log(settings)
          dispatch(initSettings(settings))
        }),
        await globalListen<string>("update_setting", ({payload})=> {
          const {key, value} = JSON.parse(payload)
          dispatch(updateSetting({key, value}))
  
        }),
        await globalListen<string>("assets", ({payload})=> {
          const assets = JSON.parse(payload)
          window.assets = assets
          window.assets_map = {}
          Object.values(assets).forEach((list: AllAssetTypes[])=> {
            list.forEach(a=> window.assets_map[a.id] = a)
          })
          searchengine.initPayload = ()=> assets
        }),
        await globalListen<string>("assetdesc", ({payload})=> {
          const assetdesc = JSON.parse(payload)
          Object.keys(assetdesc).forEach(k=> {
            window.assets_map[k].description = assetdesc[k]
          })
        }),
        await globalListen<string>("anim_predictable_data", ({payload})=> {
          const data = JSON.parse(payload)
          const {hashmap} = data
          hashmap.forEach(([k,v])=> {
            window.hash.set(v, k)
          })
        }),
      ]

      try{
        await invoke("app_init")
        window.app_init = true
      }
      catch(error) {
        if (error.message === "window.__TAURI_IPC__ is not a function")
          return
        else
          appWindow.emit("lua_init_error", error)
      }

      return handlers
    }
    const handlers = init()
    return ()=> { handlers.then(fns=> fns.forEach(f=> f())) }
  }, [])

  return <>
    <ErrorHandler/>
    <GameRootSetter isOpen={requestRoot} onClose={()=> {}}/>
  </>
}

type AlertPayload = {
  title: string,
  message: string,
} & AlertProps

export function ErrorHandler(){
  const [initError, setInitError] = useState<string>()
  const [luaError, setLuaError] = useState<string>()
  const [alert, setAlertData] = useState<AlertPayload>()

  useEffect(()=> {
    async function init() {
      const handlers = [
        await globalListen<string>("lua_init_error", ({payload})=> {
          setInitError(payload)
        }),
        await globalListen<string>("lua_call_error", ({payload})=> {
          console.error(payload)
          setLuaError(payload)
        }),
        await globalListen<AlertPayload>("alert", ({payload})=> {
          console.warn(payload)
          payload.isOpen = true
          setAlertData(payload)
        })
      ]
      return handlers
    }
    const handlers = init()
    return ()=> { handlers.then(fns=> fns.forEach(f=> f())) }
  }, [])

  const copyErrorMessage = ()=> {
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
      onConfirm={()=> setLuaError(undefined)}
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
    {
      typeof alert === "object" && 
      <Alert
        icon={alert.icon}
        isOpen={alert.isOpen}
        intent={alert.intent || 'warning' }
        confirmButtonText="好的"
        onConfirm={()=> setAlertData(undefined)}
        onCancel={()=> setAlertData(undefined)}
        canEscapeKeyCancel={true}
        canOutsideClickCancel={true}
        style={{maxWidth: 500, width: 500}}
      >
        <H3>{alert.title}</H3>
        <p>{alert.message}</p>
      </Alert>
    }
  </>
}

export {}