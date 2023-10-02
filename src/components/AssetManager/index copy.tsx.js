import React, { useCallback, useEffect, useReducer, useState } from 'react'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { invoke } from '@tauri-apps/api'
import { AnimationData, BuildData, Element, FrameList } from '../AnimCore_Canvas/animcore'
import { predict } from '../../asyncsearcher'
import { PredictableData } from '../../renderer_predict'

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
    type: string,
    message?: string,
  },
}

type AssetState = {
  animData: {[K: string]: AssetData<AnimationData[]>},
  buildData: {[K: string]: AssetData<BuildData>},
  atlasData: {[K: string]: AssetData<ImageBitmap>},

  buildNames: Set<string>,
  banks: Map<number, Set<string>>,

  onBuildLoaded: ()=> void,
  onAnimationLoaded: ()=> void,
}

type Action = {
  type: "init",
  payload: PredictableData,
} | 
{
  type: "loadBuild",
  payload: string,
}

const assetReducer = (state: AssetState, action: Action): AssetState => {
  switch (action.type) {
    case "init": {
      const {build, animation} = action.payload
      const newState = {
        ...state,
        buildNames: new Set(build),
        banks: new Map(animation.map(
          ({animation, bank})=> [bank, new Set(animation.map(({name})=> name))]
        ))
      }
      return newState
    }
    case "loadBuild":
      const build = action.payload
      const data = state.buildData[build]
      if (!data) {
        if (state.buildNames.has(build)) {
          console.log("Load!!!", build)
          async function load() {
            try {
              const response = await get<string>({type: "build", name: build})
              if (response.length > 0){
                const data: BuildData = JSON.parse(response)
                data.symbolMap = {}
                data.symbol.forEach(({imghash, imglist})=> {
                  data.symbolMap[imghash] = imglist
                })
                state.buildData[build] = {
                  state: "loaded",
                  data,
                }
                state.onBuildLoaded()
              }
              else{
                state.buildData[build] = {
                  state: "error",
                  error: { type: "NotExists" }
                }
              }
            }catch(e){
              state.buildData[build] = {
                state: "error",
                error: { type: "IntervalError", message: "Failed to load build ["+build+"], "+e.message }
              }
            }
          }
          load()
          return {
            ...state,
            buildData: { ...state.buildData, [build]: {state: "loading"}}
          }
        }
        else {
          return {
            ...state,
            buildData: { ...state.buildData, [build]: {state: "invalid"}}
          }
        }
      }
  }
  return state
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

function animLoader({bank, animation}: {bank: hash, animation: string}, error): AnimationData[] | undefined{
  // console.log(`animLoader{bank: ${bank}, animation: ${animation}}`)
  const bankhash = typeof bank == "string" ? smallhash(bank) : bank
  if (typeof bankhash !== "number" || !animation) return
  const id = bankhash + "@" + animation
  if (animData[id] !== undefined) return animData[id]
  if (animLoading[id]) return 
  async function load(){
    const debugName = "[" + bank + "]" + animation
    try {
      animLoading[id] = true
      const response = await get<string>({type: "animation", bank: bankhash, name: animation})
      if (response.length > 0){
        const data: AnimationData[] & {allFacings: number[]} = JSON.parse(response)
        delete animLoading[id]
        data.allFacings = []
        data.forEach(anim=> data.allFacings.push(anim.facing))
        data.forEach(anim=> 
          anim.frame.forEach(frame=> frame.sort((a, b)=> b.z_index - a.z_index)))
        console.log("Load animation success: " + debugName)
        animData[id] = data
      }
      else{
        pushError(error, "Animation not exists: " + debugName)
      }
    }catch(e){
      console.error(e)
      pushError(error, "Animation loading error: " + debugName + " - " + e)
    }
  }
  load()
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

function buildLoader({build}: {build: string}, error): BuildData | undefined{
  // console.log(`buildLoader{build: ${build}}`)
  if (!build) return
  const id = build
  if (buildData[id] !== undefined) return buildData[id]
  if (buildLoading[id]) return
  async function load(){
    try {
      buildLoading[id] = true
      const response = await get<string>({type: "build", name: build})
      if (response.length > 0){
        const data: BuildData = JSON.parse(response)
        data.symbolMap = {}
        data.symbol.forEach(({imghash, imglist})=> {
          data.symbolMap[imghash] = imglist
        })
        delete buildLoading[id]
        buildData[id] = data
        onNewBuildLoaded()
      }
      else{
        pushError(error, "Build not exists: " + id)
      }
    }catch(e){
      pushError(error, "Build loading error: " + id + " - " + e.message)
    }
  }
  load()
}

function atlasLoader({build, sampler}: {build: string, sampler: number}, error): AtlasObject | undefined{
  // console.log(`atlasLoader{build: ${build}, sampler: ${sampler}}}`)
  if (!build || typeof sampler !== "number") return
  const id = build + "@" + sampler
  if (atlasData[id] !== undefined) return atlasData[id]
  if (atlasLoading[id]) return
  async function load(){
    try {
      atlasLoading[id] = true
      const response = await get<number[]>({type: "atlas", build, sampler, format: "png"})
      if (response.length > 0){
        const array = Uint8Array.from(response)
        const blob = new Blob([array])
        const atlas = await createImageBitmap(blob)
        delete atlasLoading[id]
        console.log("Load atlas success: " + id)
        atlasData[id] = atlas
      }
      else {
        pushError(error, "Atlas not exists: " + id)
      }
    }catch(e){
      pushError(error, "Atlas loading error: " + id + " - " + e.message)
    }
  }
  load()
}

const defaultLoaders = { animLoader, buildLoader, atlasLoader }

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
        const animData = anim.getActualFacing(animList)
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

function startWallUpdating(){
  lastUpdateTime = -1
  requestAnimationFrame(onUpdate)
}

function addCanvas(canvas){
  if (!updatingCanvas.has(canvas)){
    updatingCanvas.add(canvas)
    if (updatingCanvas.size === 1){
      startWallUpdating()
    }
  }
  // console.log("<add canvas> size changed to: ", updatingCanvas.size)
}

function removeCanvas(canvas){
  updatingCanvas.delete(canvas)
  // console.log("<remove canvas> size changed to", updatingCanvas.size)
}

function onNewBuildLoaded() {
  updatingCanvas.forEach(canvas=> {
    canvas.anims.forEach(anim=> {
      anim.rebuildSymbolSource()
    })
  })
}

const observer = new IntersectionObserver(entries=> {
  entries.forEach(({isIntersecting, target})=> {
    isIntersecting ? addCanvas(target) : removeCanvas(target)
  })
}, {rootMargin: "100px"})

/** link an AnimState instant to canvas */
function addAnimState(
  canvas: HTMLCanvasElement & CanvasRendererExt, 
  animstate: AnimState | AnimState[] | object, 
  loaders = {},
  renderParams?: IRenderParams,
): void
{
  observer.observe(canvas)
  canvas.ctx = canvas.getContext("2d") as CanvasRenderingContext2D
  canvas.render = canvas.render || new RenderParams(renderParams)
  canvas.anims = canvas.anims || new Array<AnimState>()

  if (animstate instanceof Array){
    animstate.forEach(a=> addAnimState(canvas, a, loaders))
    return
  }
  if (!(animstate instanceof AnimState)){
    animstate = new AnimState(animstate)
  }
  // object type is consumed
  // (<AnimState>animstate).registerLoaders({...defaultLoaders, ...loaders} as any)
  // canvas.anims.push(<AnimState>animstate)
}

/** bisearch the actual image index to render */
const getImgIndex = (imgList: ImageData[], index: number): number=> {
  if (imgList.length === 1) return 0
  let i = 0, j = index
  if (imgList[j].index < index) return j
  while (1){
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

export {
  addAnimState,
  removeCanvas,
}

export type CanvasRenderer = HTMLCanvasElement & CanvasRendererExt

/** dedicated asset loader for anim renderer subwindow */
export default function AssetManager(props: {animstate: AnimState}) {
  const [ready, setReady] = useState(false)
  const [state, dispatch] = useReducer(assetReducer, {
    animData: {},
    buildData: {},
    atlasData: {},
    buildNames: new Set<string>(),
    banks: new Map(),
    onBuildLoaded: ()=> console.log("BuildLoaded"),
    onAnimationLoaded: ()=> console.log("AnimLoaded")
  })

  const loadBuild = useCallback((build: string)=> {
    if (!ready) return
    if (!state.buildNames.has(build)) return
    const data = state.buildData[build]
    if (data){
      return data.state === "loaded" ? data.data : undefined
    }
    console.log("Load!!!", build)
    async function load() {
      dispatch({type: "loadBuild", payload: build})
      try {
        const response = await get<string>({type: "build", name: build})
        if (response.length > 0){
          const data: BuildData = JSON.parse(response)
          data.symbolMap = {}
          data.symbol.forEach(({imghash, imglist})=> {
            data.symbolMap[imghash] = imglist
          })
          state.buildData[build] = {
            state: "loaded",
            data,
          }
          state.onBuildLoaded()
        }
        else{
          state.buildData[build] = {
            state: "error",
            error: { type: "NotExists" }
          }
        }
      }catch(e){
        state.buildData[build] = {
          state: "error",
          error: { type: "IntervalError", message: "Failed to load build ["+build+"], "+e.message }
        }
      }
    }
    load()

  }, [ready, state])

  useEffect(()=> {
    const timer = setInterval(()=> {
      const data: PredictableData = predict.initPayload?.()
      if (data) {
        setReady(true)
        dispatch({type: "init", payload: data})
        clearInterval(timer)
      }
    }, 100)
    return ()=> clearInterval(timer)
  }, [])

  return (
    <></>
  )
}
