import React, { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import { writeText } from '@tauri-apps/api/clipboard'
import { appWindow, getCurrent } from '@tauri-apps/api/window'
import { listen as globalListen, once as globalListenOnce } from '@tauri-apps/api/event'
import { Alert, AlertProps, Button, H3, useHotkeys } from '@blueprintjs/core'
import GameRootSetter from '../GameRootSetter'
import { searchengine } from '../../asyncsearcher'
import { useDispatch, useSelector } from '../../redux/store'
import { AppSettings, init as initSettings, update as updateSetting } from '../../redux/reducers/appsettings'
import { MeiliSearch } from 'meilisearch'
import type { AllAssetTypes } from '../../searchengine'
import type { AssetDesc } from '../../assetdesc'
import { setAddr, addDocuments, search } from '../../global_meilisearch'

// shutdown app if main window is closed. (so that all sub windows will be closed, too)
globalListen("tauri://destroyed", (e)=> {
  if (e.windowLabel === "main")
    invoke("shutdown", {reason: "MainWindowDestroyed"})
})

function generateDocument(data: {[K: string]: AllAssetTypes[]}) {
  const result = []
  Object.values(data).forEach(v=> v.forEach(item=> {
    const {id, type} = item
    if (type === "animdyn" || type === "animzip"){
      const {file} = item
      result.push({id, type, file})
    }
    else if (type === "tex"){
      const {xml, tex} = item
      result.push({id, type, xml, tex})
    }
    else if (type === "tex_no_ref"){
      const {file} = item
      result.push({id, type, file})
    }
    else if (type === "xml"){
      const {file, texpath} = item
      result.push({id, type, file,texpath})
    }
    else if (type === "fmodevent"){
      const {path} = item
      result.push({id, type, fmodpath: path})
    }
    else if (type === "fmodproject"){
      const {file} = item
      result.push({id, type, file})
    }
    else {
      throw Error("Invalid asset type: " + type)
    }
  }))
  const ids = new Set()
  result.forEach(item=> {
    if (!item.id) {
      throw Error("Asset must include id: " + JSON.stringify(item))
    }
    else if (ids.has(item.id)){
      throw Error("Asset id not unique: " + JSON.stringify(item))
    }
    else {
      ids.add(item.id)
    }
  })

  return result
}

export default function AppInit() {
  const root = useSelector(({appsettings})=> appsettings.last_dst_root)
  const requestRoot = typeof root === "string" && root.length === 0

  const dispatch = useDispatch()

  useEffect(()=> {
    let unlisten = appWindow.listen<any>("update_assets", ({payload})=> {
      const doc = generateDocument(payload)
      addDocuments("assets", doc)
    })

    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    async function init() {
      const handlers = [
        await globalListen<string>("settings", ({payload})=> {
          const settings: AppSettings = JSON.parse(payload)
          dispatch(initSettings(settings))
        }),
        await globalListen<string>("update_setting", ({payload})=> {
          const {key, value} = JSON.parse(payload)
          dispatch(updateSetting({key, value}))
  
        }),
        await globalListen<string>("assets", ({payload})=> {
          const assets = JSON.parse(payload)
          window.assets = {...window.assets, ...assets}
          Object.values(assets).forEach((list: AllAssetTypes[])=> {
            list.forEach(item=> window.assets_map[item.id] = item)
          })
          appWindow.emit("update_assets", assets)
          searchengine.initPayload = ()=> window.assets
        }),
        await globalListen<string>("assetdesc", ({payload})=> {
          const assetdesc: {[K: string]: AssetDesc} = JSON.parse(payload)
          Object.keys(assetdesc).forEach(k=> {
            // console.log(assetdesc[k])
            window.assets_map[k].description = assetdesc[k]
            window.assets_map[k].description_debug = assetdesc[k].find(d=> d.type === "plain").value
          })
        }),
        await globalListen<string>("anim_predictable_data", ({payload})=> {
          const data = JSON.parse(payload)
          const {hashmap} = data
          window.hash = window.hash || new Map()
          hashmap.forEach(([k,v])=> {
            window.hash.set(v, k)
          })
        }),
      ]

      try{
        await invoke("app_init")
        window.app_init = true

        // create meilisearch client before registering `assets` event handler
        const addr = await invoke<string>("meilisearch_get_addr")
        setAddr(addr)
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
    <ThemeHandler/>
    <GlobalHotKey/>
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
        await globalListen<string>("fmod_call_error", ({payload})=> {
          console.error(payload)
          setLuaError(payload) // temp use...
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
        intent={alert.intent || "warning" }
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

function ThemeHandler() {
  const dispatch = useDispatch()
  useEffect(()=> {
    appWindow.theme().then(systemTheme=> {
      dispatch(updateSetting({key: "systemTheme", value: systemTheme}))
    })
    const unlisten = appWindow.onThemeChanged(({payload: systemTheme})=> {
      dispatch(updateSetting({key: "systemTheme", value: systemTheme}))
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])
  return <></>
}

function GlobalHotKey() {
  useHotkeys([
    {
      combo: "mod + p",
      label: "搜索",
      global: true,
      onKeyDown(e) {
        e.preventDefault()
        appWindow.emit("start_search")
      },
    }
  ])
  return <></>
}