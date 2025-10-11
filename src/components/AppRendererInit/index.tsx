import { useEffect, useState } from 'react'
import { listen as globalListen, once as globalListenOnce } from '@tauri-apps/api/event'
import { ErrorHandler} from '../AppInit'
import { PredictableData } from '../../renderer_predict'
import { useLuaCall } from '../../hooks'
import { predict } from '../../asyncsearcher'
import { AllAssetTypes } from '../../searchengine'
import { setState } from '../../redux/reducers/appstates'
import { useDispatch } from '../../redux/store'
import { invoke } from '@tauri-apps/api/core'
import type { BuildData, AnimationData } from '../AnimCore_Canvas/animcore'

declare global {
  interface Window {
    mod_anim_asset_data: {
      rawData: ModAnimAssetData,
      animIndex: AnimIndex,
      buildIndex: BuildIndex,
      hashCollection: Set<number>,
    }
  }
}

window.assets = {} as any
window.assets_map = {}
window.mod_anim_asset_data = {rawData: {}, animIndex: new Map(), buildIndex: new Map(), hashCollection: new Set()}

export type ModAnimAsset = {
  path: string,
  error?: string,
  anim: {
    anim_list: AnimationData[],
    error?: string,
  }
  build: {
    build_data: BuildData,
    error?: string,
  }
}

export type ModAnimAssetData = {
  [K: string]: ModAnimAsset
}

type BuildDataWithPath = { path: string } & BuildData
type AnimationDataWithPath = { path: string } & AnimationData
export type AnimIndex = Map<string, AnimationDataWithPath[]>
export type BuildIndex = Map<string, BuildDataWithPath[]>

export default function AppRendererInit() {
  const dispatch = useDispatch()
  const initCall = useLuaCall<string>("animproject.init", (result)=> {
    const data = JSON.parse(result)
    const anim_predictable_data = data.anim_predictable_data as PredictableData
    predict.initPayload = ()=> {
      // insert mod data
      const {animIndex, buildIndex} = window.mod_anim_asset_data
      const data = JSON.parse(JSON.stringify(anim_predictable_data)) as PredictableData
      Array.from(buildIndex.keys()).forEach(v=> data.build.push(v))
      const bankCache = {}
      Array.from(animIndex.values()).forEach(index=> {
        index.forEach(({bankhash, name})=> {
          if (!bankCache[bankhash]) {
            const v = data.animation.find(a=> a.bank === bankhash)
            if (v) {
              bankCache[bankhash] = v.animation
            }
            else {
              bankCache[bankhash] = []
              data.animation.push({bank: bankhash, animation: bankCache[bankhash]})
            }
          }
          bankCache[bankhash].push({name, facings: []})
        })
      })
      return data
    }
    window.hash = new Map(data.anim_predictable_data.hashmap.map(([k,v])=> [v,k]))
    dispatch(setState({key: "predict_init_flag", value: true}))
  })

  const [modAsset, setModAsset] = useState<ModAnimAssetData>({})
  const updateModAsset = (newData: ModAnimAssetData)=> {
    setModAsset(data=> ({...data, ...newData}))
  }

  useEffect(()=> {
    console.log("Mod asset changed", modAsset)
    const buildIndex = new Map() as BuildIndex // build name -> build path
    const animIndex = new Map() as AnimIndex // [bankhash]-anim name -> anim path (all facing)
    const hashCollection = new Set<number>()
    Object.values(modAsset).forEach(({path, build, anim})=> {
      if (anim && !anim.error) {
        anim.anim_list.forEach(a=> {
          const key = `[${a.bankhash}]-${a.name}`
          if (!animIndex.has(key)) {
            animIndex.set(key, [])
          }
          animIndex.get(key)!.push({path, ...a})
        })
      }
      if (build && !build.error) {
        let key = build.build_data.name
        if (!buildIndex.has(key)) {
          buildIndex.set(key, [])
        }
        const data = build.build_data
        data.symbolMap = {}
        data.symbol.forEach(({imghash, imglist})=> {
          data.symbolMap[imghash] = imglist
        })
        buildIndex.get(key)!.push({path, ...data})
      }
    })
    Array.from(animIndex.values()).forEach(data=> {
      // @ts-ignore
      data.allFacings = []
      data.forEach(anim=> {
        // @ts-ignore
        data.allFacings.push(anim.facing)
        anim.frame.forEach(frame=> frame.sort((a, b)=> b.z_index - a.z_index))
        hashCollection.add(anim.bankhash)
      })
    })
    window.mod_anim_asset_data.animIndex = animIndex
    window.mod_anim_asset_data.buildIndex = buildIndex
    window.mod_anim_asset_data.hashCollection = hashCollection
    window.mod_anim_asset_data.rawData = modAsset

    window.emitToThis("update_mod_anim_asset")
  }, [modAsset])

  useEffect(()=> {
    try {
      (async()=> {
        const path_list = await invoke("remove_mod_anim_files", {path_list: []})
        const result = await invoke<string>("lua_call", {api: "load_mod_anim_assets", param: JSON.stringify(path_list)})
        const data = JSON.parse(result) as ModAnimAssetData
        updateModAsset(data)
      })()
    }
    catch(e) {
      window.emit("lua_init_error", e)
    }
  }, [])

  useEffect(()=> {
    const unlisten = window.listen<string>("mod_file_changed", ({payload})=> {
      invoke<string>("lua_call", {api: "load_mod_anim_assets", param: JSON.stringify([payload])}).then(
        result=> {
          const data = JSON.parse(result) as ModAnimAssetData
          updateModAsset(data)
        },
        error=> {
          window.emit("lua_init_error", error)
        },
      )
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

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
          window.emit("lua_init_error", error)
        }
      }
    }
    let handlers = init()
    return ()=> { handlers.then(fns=> fns.forEach(f=> f())) }
  }, [initCall])

  return <>
    <ErrorHandler/>
  </>
}