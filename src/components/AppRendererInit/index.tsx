import React, { useEffect } from 'react'
import { appWindow } from '@tauri-apps/api/window'
import { listen as globalListen, once as globalListenOnce } from '@tauri-apps/api/event'
import { ErrorHandler} from '../AppInit'
import { PredictableData } from '../../renderer_predict'
import { useLuaCall } from '../../hooks'
import { predict } from '../../asyncsearcher'
import { AllAssetTypes } from '../../searchengine'
import { setState } from '../../redux/reducers/appstates'
import { useDispatch } from '../../redux/store'

window.assets = {} as any
window.assets_map = {}

export default function AppRendererInit() {
  const dispatch = useDispatch()
  const initCall = useLuaCall<string>("animproject.init", (result)=> {
    const data = JSON.parse(result)
    predict.initPayload = ()=> {
      return data.anim_predictable_data as PredictableData
    }
    window.hash = new Map(data.anim_predictable_data.hashmap.map(([k,v])=> [v,k]))
    dispatch(setState({key: "predict_init_flag", value: true}))
  })

  useEffect(()=> {
    async function init() {
      try{
        const handlers = [
          // await globalListenOnce("allconfig", ({payload})=> {
          //   const config = JSON.parse(payload)
          //   Object.keys(config).forEach(k=> window.config[k] = config[k]) 
          //   if (config.colortheme) {
          //     appWindow.emit("colortheme", config.colortheme)
          //   }
          // }),
          await globalListenOnce<string>("assets", ({payload})=> {
            const assets = JSON.parse(payload)
            window.assets = assets
            window.assets_map = {}
            Object.values(assets).forEach((list: AllAssetTypes[])=> {
              list.forEach(a=> window.assets_map[a.id] = a)
            })
          }),
          // await globalListenOnce<string>("anim_predictable_data", ({payload})=> {
          //   const data = JSON.parse(payload) as PredictableData
          //   window.predict = new PredictableHelper(data)
          // }),
        ]
        initCall()
        return handlers
      }
      catch(error) {
        if (error.message === "window.__TAURI_IPC__ is not a function") {
          return
        }
        else if (error.message === "IPC_INTERRUPTED"){
          return
        }
        else {
          appWindow.emit("lua_init_error", error)
        }
      }
    }
    let handlers = init()
    return ()=> { handlers.then(fns=> fns.forEach(f=> f())) }
  }, [])

  // useEffect(()=> {
  //   let unlisten = globalListen("updateconfig", ({payload})=> {
  //     const {key, value} = JSON.parse(payload as string)
  //     window.config[key] = value
  //   })
  //   return ()=> unlisten.then(f=> f())
  // }, [])

  return <>
    <ErrorHandler/>
  </>
}