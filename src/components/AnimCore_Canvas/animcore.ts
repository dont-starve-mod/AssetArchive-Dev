import smallhash from "../../smallhash"
import { hash, AnimState } from "./animstate"
import { RenderParams, IRenderParams } from "./renderparams"
import { invoke } from "@tauri-apps/api"

/* 动画资源 */
const buildLoading: {[K: string]: true} = {}
const buildData: {[K: string]: BuildData} = {}
const animLoading: {[K: string]: true} = {}
const animData : {[K: string]: AnimationData[]}= {}
const atlasLoading: {[K: string]: true} = {}
const atlasData: {[K: string]: AtlasObject} = {}

/* 动画资源加载器 */
function pushError(error: any, msg: any){
  // 这个函数得再看看...
  console.log("error:", error, msg)
  return
  if (typeof error === "function"){
    return error(msg)
  }
  else if (error && error.forEach){
    // 注意修改列表不会触发React组件更新
    error.push(msg)
  }
}

interface Element {
  imghash: number,
  imgindex: number,
  layerhash: number,
  matrix: [number, number, number, number, number, number],
  z_index: number,
}

type Frame = Element[]
export type FrameList = Frame[]

export interface AnimationData {
  name: string,
  bankhash: number,
  facing: number
  frame: FrameList,
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

export interface BuildData {
  name: string,
  atlas: string[],
  symbol: SymbolData[],
  symbolMap: {[K: number]: ImageData[]},
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

// const toInt = b=> b[3]*16777216 + b[2]*65535 + b[1]*256 + b[0]

type AtlasObject = ImageBitmap

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
  (<AnimState>animstate).registerLoaders({...defaultLoaders, ...loaders} as any)
  canvas.anims.push(<AnimState>animstate)
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