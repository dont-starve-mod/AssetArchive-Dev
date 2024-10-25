import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { invoke } from '@tauri-apps/api'
import { AnimationData, BuildData, Element, FrameList } from '../AnimCore_Canvas/animcore'
import { predict } from '../../asyncsearcher'
import { PredictableData } from '../../renderer_predict'
import { appWindow } from '@tauri-apps/api/window'
import smallhash from '../../smallhash'
import { message } from '@tauri-apps/api/dialog'
import { RenderParams } from '../AnimCore_Canvas/renderparams'

type AssetData<T> = {
  state: "loading",
} | {
  state: "loaded",
  data: T,
} | {
  state: "invalid",
}
| {
  state: "error",
  error: {
    type: "NotExists" | "IntervalError",
    message?: string,
    debugName?: string,
  },
}

export type AssetState = {
  animData: {[K: string]: AssetData<AnimationData[]>},
  buildData: {[K: string]: AssetData<BuildData>},
  atlasData: {[K: string]: AssetData<ImageBitmap>},

  buildNames: Set<string>,
  banks: Map<number, Set<string>>,
}

async function get<T>(param: {[K:string]: string | number | boolean}): Promise<T> {
  const response: T = await invoke("lua_call", {
    api: "load",
    param: JSON.stringify(param),
  })
  if (response as string === "null"){ // filter `nil` from Lua
    return "" as T
  }
  else {
    return response
  }
}

interface ImageData {
  index: number,
  bbx: number,
  bby: number,
  ch: number,
  cw: number,
  duration: number,
  sampler: number,
  h: number,
  w: number,
  x: number,
  y: number,
}

interface SymbolData {
  imghash: number,
  imglist: ImageData[],
}


const int = (i: number)=> Math.round(i)

interface CanvasRendererExt {
  ctx: CanvasRenderingContext2D,
  anims: AnimState[],
  render: RenderParams,
  logicalSize: { width: number, height: number }
}
// updater
const updatingCanvas = new Set<HTMLCanvasElement & CanvasRendererExt>()
let lastUpdateTime = -1
function onUpdate(time: number){
  if (!window.app_init){ /* `app_init` is a flag that backend assetprovider is ready */
    requestAnimationFrame(onUpdate)
    return 
  } 
  let dt = 1000/60
  if (lastUpdateTime !== -1){
    dt = time - lastUpdateTime
  }
  lastUpdateTime = time
  if (updatingCanvas.size){
    updatingCanvas.forEach(canvas=> {
      const ctx = canvas.ctx
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.anims.forEach(anim=> {
        const animList: AnimationData[] = anim.animLoader({bank: anim.bank, animation: anim.animation})
        if (!animList || animList.length === 0) return
        const animData = anim.getActualAnimData(animList)
        if (!animData) return
        anim.setFrameList(animData.frame)
        anim.update(dt)
        const frame = anim.frameList[anim.currentFrame]
        if (!frame) return
        /* render frame */
        ctx.save()
        ctx.transform(
          window.devicePixelRatio, 0, 0, window.devicePixelRatio, /* fix scale */
          canvas.logicalSize.width/2* window.devicePixelRatio,  /* move to center */
          (canvas.logicalSize.height/2 + (
            canvas.render.centerStyle === "center" ? 0 :
            canvas.render.centerStyle === "ground" ? 0.25* canvas.logicalSize.height:
            0.45* canvas.logicalSize.height))* window.devicePixelRatio, 
        )
        const renderAxis = ()=> {
          ctx.save()
          ctx.translate(...canvas.render.axisOrigin())
          ctx.fillStyle = "#000"
          ctx.fillRect(-50000, 0, 100000, 1)
          ctx.fillRect(0, -50000, 1, 100000)
          ctx.restore()
        }

        if (canvas.render.axis === "back") renderAxis()

        ctx.save()
        ctx.transform(...canvas.render.transform) /* 渲染参数矩阵 */
        frame.forEach(({imghash, imgindex, layerhash, matrix})=> {
          if (!anim.shouldRender({imghash, layerhash})) return
          const [sourceBuild, symbol] = anim.getSourceBuild(imghash)
          const imgList = sourceBuild && sourceBuild.symbolMap[symbol]
          if (!imgList || imgList.length === 0) return
          const index = getImgIndex(imgList, imgindex)
          if (index === -1) return
          const img = imgList[index]
          /* sprite */
          const {bbx, bby, cw, ch, x, y, w, h, sampler} = img
          const atlas = anim.atlasLoader({build: sourceBuild.name, sampler})
          if (!atlas) return
          const {width: WIDTH, height: HEIGHT} = atlas // Atlas image
          const x_scale = WIDTH / cw, y_scale = HEIGHT / ch
          ctx.save()
          ctx.transform(...matrix) /* affine transform matrix */
          ctx.drawImage(atlas, int(bbx*x_scale), int(bby*y_scale), int(w*x_scale), int(h*y_scale),
            x-w/2, y-h/2, w, h) /* bbox & anchor */
          ctx.restore()
        })
        ctx.restore()
        if (canvas.render.axis === "front") renderAxis()
        ctx.restore()
      })
    })
    requestAnimationFrame(onUpdate)
  }
}

/** bisearch the actual image index to render */
const getImgIndex = (imgList: ImageData[], index: number): number=> {
  if (imgList.length === 1) return 0
  let i = 0, j = Math.min(index, imgList.length - 1)
  if (imgList[j].index < index) return imgList[j].index + imgList[j].duration > index ? j : -1
  if (imgList[0].index > 0 && imgList[0].index >= index) return imgList[0].index === index ? 0 : -1
  for (let n = 0; n < 1000; ++n){
    console.log(i, j)
    if (imgList[i].index === index) return i
    if (imgList[j].index === index) return j
    let k = Math.floor((i+j)/2)
    if (i === k) return i
    if (imgList[k].index === index) return k
    else if (imgList[k].index > index) j = k
    else i = k
  }
  throw Error("unreachable")
}

/** dedicated asset loader for anim renderer subwindow */
export default function AssetManager(props: {animstate: AnimState, stateRef?: (state: AssetState)=> void}) {
  const {animstate, stateRef} = props
  const [ready, setReady] = useState(false)
  const state = useRef<AssetState>({
    animData: {},
    buildData: {},
    atlasData: {},
    buildNames: new Set<string>(),
    banks: new Map(),
  }).current

  useEffect(()=> {
    stateRef?.(state)
  }, [stateRef])

  const globalForceUpdate = useCallback(()=> {
    appWindow.emit("forceupdate", "AssetManager")
  }, [])

  const onBuildLoaded = useCallback(()=> {
    animstate.rebuildSymbolSource()
  }, [animstate])

  const loadBuild = useCallback(({build}: {build: string})=> {
    if (!ready) return
    if (!state.buildNames.has(build)) return
    const data = state.buildData[build]
    if (data){
      return data.state === "loaded" ? data.data : undefined
    }
    async function load() {
      state.buildData[build] = { state: "loading" }
      try {
        const response = await get<string>({type: "build", name: build})
        if (response.length > 0){
          const data: BuildData = JSON.parse(response)
          data.symbolMap = {}
          data.symbol.forEach(({imghash, imglist})=> {
            data.symbolMap[imghash] = imglist
          })
          state.buildData[build] = { state: "loaded", data }
          onBuildLoaded()
        }
        else{
          state.buildData[build] = { state: "error", error: { type: "NotExists" } }
        }
      }catch(e){
        state.buildData[build] = {
          state: "error",
          error: { type: "IntervalError", message: e.message }
        }
      }
    }
    load()
  }, [ready, onBuildLoaded])

  const onAnimationLoaded = useCallback(()=> {
    animstate.rebuildFrameList()
  }, [animstate])

  const loadAnimation = useCallback(({bank, animation}: {bank: string | number, animation: string})=> {
    if (!ready) return
    const debugName = `[${bank}]${animation}`
    if (typeof bank === "string")
      bank = smallhash(bank)
    const animNames = state.banks.get(bank)
    if (!animNames) return
    if (!animNames.has(animation)) return
    const id = `[${bank}]${animation}`
    const data = state.animData[id]
    if (data){
      return data.state === "loaded" ? data.data : undefined
    }
    async function load(){
      state.animData[id] = { state: "loading" }
      try {
        const response = await get<string>({type: "animation", bank, name: animation})
        if (response.length > 0){
          const data: AnimationData[] & {allFacings: number[]} = JSON.parse(response)
          data.allFacings = []
          data.forEach(anim=> {
            data.allFacings.push(anim.facing)
            anim.frame.forEach(frame=> frame.sort((a, b)=> b.z_index - a.z_index))
          })
          state.animData[id] = { state: "loaded", data }
          onAnimationLoaded()
        }
        else{
          state.animData[id] = { state: "error", error: { type: "NotExists", debugName } }
        }
      }catch(e){
        state.animData[id] = { state: "error", error: { type: "IntervalError", message: e.message, debugName }}
      }
    }
    load()
  }, [ready, onAnimationLoaded])

  const loadAtlas = useCallback(({build, sampler}: {build: string, sampler: number})=> {
    if (!ready) return
    if (!state.buildNames.has(build)) return
    const debugName = `${build}-${sampler}`
    const id = debugName
    const data = state.atlasData[id]
    if (data){
      return data.state === "loaded" ? data.data : undefined
    }
    async function load(){
      state.atlasData[id] = { state: "loading" }
      try {
        const response = await get<number[]>({type: "atlas", build, sampler, format: "png"})
        if (response.length > 0){
          const array = Uint8Array.from(response)
          const blob = new Blob([array])
          const atlas = await createImageBitmap(blob)
          state.atlasData[id] = { state: "loaded", data: atlas }
        }
        else {
          state.atlasData[id] = { state: "error", error: { type: "NotExists", debugName } }
        }
      }catch(e){
        state.atlasData[id] = { state: "error", error: {type: "IntervalError", message: e.message, debugName }}
      }
    }
    load()
  }, [ready])

  useEffect(()=> {
    const timer = setInterval(()=> {
      const data: PredictableData = predict.initPayload?.()
      if (data) {
        const {build, animation} = data
        state.buildNames = new Set(build)
        state.banks = new Map(animation.map(
          ({animation, bank})=> [bank, new Set(animation.map(({name})=> name))]
        ))
        setReady(true)
        globalForceUpdate()
        clearInterval(timer)
      }
    }, 100)
    return ()=> clearInterval(timer)
  }, [state])

  useEffect(()=> {
    animstate.registerLoaders({
      animLoader: loadAnimation,
      buildLoader: loadBuild,
      atlasLoader: loadAtlas,
    })
    return
  }, [loadBuild])

  return (
    <></>
  )
}
