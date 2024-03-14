import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import { writeText } from '@tauri-apps/api/clipboard'
import { appWindow } from '@tauri-apps/api/window'
import { listen as globalListen, once as globalListenOnce } from '@tauri-apps/api/event'
import { Alert, AlertProps, H3, useHotkeys } from '@blueprintjs/core'
import GameRootSetter from '../GameRootSetter'
import { searchengine } from '../../asyncsearcher'
import { useDispatch, useSelector } from '../../redux/store'
import { AppSettings, init as initSettings, update as updateSetting } from '../../redux/reducers/appsettings'
import { MeiliSearch } from 'meilisearch'
import type { AllAssetTypes, ArchiveItem, Entry } from '../../searchengine'
import type { AssetDesc } from '../../assetdesc'
import { setAddr, addDocuments, search } from '../../global_meilisearch'
import { useOS } from '../../hooks'
import { formatAlias } from '../AliasTitle'
import RenderProgress from '../RenderProgress'
import { initStaticPageData } from '../../pages/AssetPage/static'

// shutdown app if main window is closed. (so that all sub windows will be closed, too)
globalListen("tauri://destroyed", (e)=> {
  if (e.windowLabel === "main")
    invoke("shutdown", {reason: "MainWindowDestroyed"})
})

function generateDocument(data: {[K: string]: ArchiveItem[]}) {
  const result = []
  Object.entries(data).forEach(([k, v])=> {
    console.log("generate for key: " + k, Array.isArray(v))
    if (!Array.isArray(v)) return
    for (let item of v){
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
      else if (type === "shader") {
        const {file, _vs, _ps} = item
        result.push({id, type, file})
      }
      else if (type === "bank") {
        const {bank, animationList} = item
        const bankName = window.hash.get(bank)
        result.push({id, type, plain_desc: bankName, animationList})
      }
      else if (type === "multi_xml"){
        // TODO: push static entry to meilisearch?
      }
      else {
        console.warn("Invalid asset type", item)
      }
    }
  })
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
    let unlisten = appWindow.listen<never>("update_assets_desc", ()=> {
      const doc = []
      Object.entries(window.assets_map).forEach(([id, v])=> {
        if (v.type !== "entry" && typeof v.plain_desc === "string")
          doc.push({ id, plain_desc: v.plain_desc })
      })
      console.log(doc)
      addDocuments("assets", doc)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    let unlisten = appWindow.listen<never>("update_entry", ()=> {
      const doc = []
      Object.values(window.entry_map).forEach(v=> {
        doc.push({
          id: v.id,
          plain_alias: v.plain_alias,
          plain_desc: "TODO: fix this",
        })
      })
      addDocuments("assets", doc)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    async function init() {
      const handlers = [
        await globalListen("tauri://update-status", ({payload})=> {
          console.log("UPDATE STATUS EVENT:", payload)
        }),
        await globalListen("tauri://update", ({payload})=> {
          console.log("UPDATE EVENT:", payload)
        }),
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
          initStaticPageData()
          Object.values(assets).forEach((list: AllAssetTypes[])=> {
            list.forEach(item=> window.assets_map[item.id] = item)
          })
          appWindow.emit("update_assets", assets)
          searchengine.initPayload = ()=> window.assets
        }),
        await globalListen<string>("assetdesc", async ({payload})=> {
          const assetdesc: {[K: string]: AssetDesc} = JSON.parse(payload)
          Object.entries(assetdesc).forEach(([k, v])=> {
            if (window.assets_map[k] === undefined){
              return console.log("Warning: cannot assign desc for " + k)
            }

            let desc = []
            for (let i = 1; i < 100; ++i) {
              const d = v[i.toString()]
              if (d) {
                desc.push(d)
                if (d.startsWith("#")){
                  window.assets_tag[d] = window.assets_tag[d] || {}
                  window.assets_tag[d][k] = window.assets_map[k]
                }
              }
              else
                break
            }
            // @ts-ignore
            window.assets_map[k].desc = desc
            // @ts-ignore
            // TODO: 也许需要一个更好的写法来避免屎山
            window.assets_map[k].plain_desc = v.plain_desc
          })
          appWindow.emit("update_assets_desc")
        }),
        await globalListen<string>("entry", async ({payload})=> {
          const data: {items: any} = JSON.parse(payload)
          // window.entry = data.items
          window.entry_map = data.items
          window.assets["entry"] = {}
          Object.values(window.entry_map).forEach(v=> {
            v.id = "e-" + v.key
            v.type = "entry"
            v.plain_alias = formatAlias(v.alias)
            // for easy access
            window.assets_map[v.id] = v
          })
          appWindow.emit("update_entry")
        }),
        await globalListen<string>("animpreset", ({payload})=> {
          const data = JSON.parse(payload)
          data.auto = Object.fromEntries(data.auto.map(({bankhash, build})=> [bankhash, build]))
          data.def = data.def
          window.animpreset = data
        }),
        await globalListen<string>("anim_predictable_data", ({payload})=> {
          const data = JSON.parse(payload)
          const {hashmap, animation} = data
          window.hash = window.hash || new Map()
          hashmap.forEach(([k,v])=> {
            window.hash.set(v, k)
          })
          window.assets.allbank = animation.map(({bank, animation})=>
            ({
              id: "bank-" + bank,
              type: "bank",
              bank,
              animationList: animation.map(({name})=> name)
            }))
          Object.values(window.assets.allbank).forEach(v=> 
            window.assets_map[v.id] = v)
          appWindow.emit("update_assets", window.assets)
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
    <RenderProgress isMain/>
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
          if (payload !== "IPC_INTERRUPTED"){
            setLuaError(payload)
            appWindow.emit("lua_call_error_emitted")
          }
        }),
        await globalListen<string>("fmod_call_error", ({payload})=> {
          console.error(payload)
          setLuaError(payload) // temp use...
        }),
        await globalListen<string>("runtime_error", ({payload})=> {
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
  const {isMacOS} = useOS()
  useHotkeys([
    {
      combo: isMacOS ? "mod + p" : "ctrl + p",
      label: "搜索",
      global: true,
      onKeyDown(e) {
        e.preventDefault()
        appWindow.emit("start_search")
      },
    }
  ])
  // global listener for key pressing state
  useEffect(()=> {
    window.keystate = {}
    const map = {
      ["Control"]: !isMacOS ? "ctrl" : "",
      ["Meta"]: isMacOS ? "ctrl" : "",
    }
    const onKeyDown = (e: KeyboardEvent)=> {
      if (map[e.key]) {
        window.keystate[map[e.key]] = true
      }
    }
    const onKeyUp = (e: KeyboardEvent)=> {
      if (map[e.key]) {
        window.keystate[map[e.key]] = false
      }
    }
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("keydown", onKeyDown)
    return ()=> {
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])
  return <></>
}