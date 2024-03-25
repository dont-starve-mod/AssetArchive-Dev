import smallhash from "../../smallhash"
import { hash, AnimState } from "./animstate"
import { RenderParams, IRenderParams } from "./renderparams"
import { invoke } from "@tauri-apps/api"
import { base64DecToArr } from "../../base64_util"
import { appWindow } from "@tauri-apps/api/window"

/* Animation assets */
const buildLoading: {[K: string]: true} = {}
const buildData: {[K: string]: BuildData} = {}
const animLoading: {[K: string]: true} = {}
const animData : {[K: string]: AnimationData[]}= {}
const atlasLoading: {[K: string]: true} = {}
const atlasData: {[K: string]: AtlasObject} = {}
const elementLoading: {[K: string]: true} = {}
const elementData: {[K: string]: ImageBitmap} = {}

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

export interface Element {
  imghash: number,
  imgindex: number,
  layerhash: number,
  matrix: [number, number, number, number, number, number],
  z_index: number,
}

export type Frame = Element[]
export type FrameList = Frame[]

export type Rect = {
  left: number,
  right: number,
  top: number,
  bottom: number,
  width?: number,
  height?: number,
}

export interface AnimationData {
  name: string,
  bankhash: number,
  facing: number
  frame: FrameList,
  rect: Rect,
}

async function get<T>(param: {[K:string]: string | number | boolean}): Promise<T> {
  const response = await invoke<T>("lua_call", {
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
        animLoading[id] = undefined
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

type ImageData = {
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
        buildLoading[id] = undefined
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
      const response = await get<string>({type: "atlas", build, sampler, format: "png_base64"})
      if (response.length > 0){
        const array = Uint8Array.from(base64DecToArr(response))
        const blob = new Blob([array])
        const atlas = await createImageBitmap(blob)
        atlasLoading[id] = undefined
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

// TODO: element loader的粒度有点太细了，会导致动画中途第一次加载的图片闪烁
// 需要再优化一下

function elementLoader({build, imghash, index, thumbnailMode}: 
  {build: string, imghash: number, index: number, thumbnailMode?: boolean}, error): ImageBitmap {
  if (!build || typeof imghash !== "number" || typeof index !== "number") return
  const rp = thumbnailMode ? {max_canvas_size: 512} : {}
  const id = `${build}-${imghash}-${index}` + (thumbnailMode ? "-thumbnail" : "")
  if (elementData[id] !== undefined) return elementData[id]
  if (elementLoading[id]) return
  async function load(){
    try {
      elementLoading[id] = true
      const response = await get<string>({type: "symbol_element", build, imghash, index, format: "json", fill_gap: false, ...rp})
      if (response.length > 0){
        const {width, height, rgba} = JSON.parse(response)
        const pixels = base64DecToArr(rgba)
        const data = new ImageData(pixels, width, height)
        const img = await createImageBitmap(data)
        elementLoading[id] = undefined
        console.log("Load element success: " + id + ` (${img.width}✕${img.height})`)
        elementData[id] = img
        // fire event after every element loaded
        appWindow.emit("animation_element_loaded", {imghash})
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

const defaultLoaders = { animLoader, buildLoader, atlasLoader, elementLoader }

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
      let cleared = false
      canvas.anims.forEach(anim=> {
        const animList: AnimationData[] = anim.animLoader({bank: anim.bank, animation: anim.animation})
        if (!animList || animList.length === 0) return
        if (!anim.visible) return
        if (anim.isPaused && !anim.forceRender) return
        if (!cleared){
          cleared = true
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        const animData = anim.getActualAnimData(animList)
        if (!animData) return
        anim.setRect(animData.rect)
        anim.setFrameList(animData.frame)
        anim.update(dt)
        const frame = anim.frameList[anim.currentFrame]
        if (!frame) return
        /* render frame */
        ctx.save()
        if (canvas.render.centerStyle === "origin") {
          // react component will handle xy offset, so just scale it
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        }
        else {
          // if not calculate offset here
          ctx.transform(
            window.devicePixelRatio, 0, 0, window.devicePixelRatio, /* fix scale */
            canvas.logicalSize.width/2* window.devicePixelRatio,  /* move to center */
            (canvas.logicalSize.height/2 + (
              canvas.render.centerStyle === "center" ? 0 :
              canvas.render.centerStyle === "ground" ? 0.25* canvas.logicalSize.height:
              0.45* canvas.logicalSize.height))* window.devicePixelRatio, 
          )
        }
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
        ctx.transform(...canvas.render.transform)
        for (let element of frame){
          const {imghash, imgindex, layerhash, matrix} = element
          if (!anim.shouldRender({imghash, layerhash})) continue
          const [sourceBuild, symbol] = anim.getSourceBuild(imghash)
          const imgList = sourceBuild && sourceBuild.symbolMap[symbol]
          if (!imgList || imgList.length === 0) continue
          const index = getImgIndex(imgList, imgindex)
          const img = imgList[index]
          /* sprite */
          const {bbx, bby, cw, ch, x, y, w, h, sampler} = img
          if (anim.DEV_usingElementLoader && anim.elementLoader){
            const element = anim.elementLoader({build: sourceBuild.name, imghash: symbol, index: img.index, thumbnailMode: anim.thumbnailMode})
            if (!element) continue
            const {width: WIDTH, height: HEIGHT} = element
            // const x_scale = WIDTH / cw, y_scale = HEIGHT / ch
            const x_scale = 1, y_scale = 1 // TODO: fix symbol resize
            ctx.save()
            ctx.transform(...matrix)
            ctx.drawImage(element, 0, 0, WIDTH, HEIGHT, x-w/2, y-h/2, w, h)
            ctx.restore()
          }
          else {
            const atlas = anim.atlasLoader({build: sourceBuild.name, sampler})
            if (!atlas) continue
            const {width: WIDTH, height: HEIGHT} = atlas // Atlas image
            const x_scale = WIDTH / cw, y_scale = HEIGHT / ch
            ctx.save()
            ctx.transform(...matrix) /* affine transform matrix */
            ctx.drawImage(atlas, int(bbx*x_scale), int(bby*y_scale), int(w*x_scale), int(h*y_scale),
              x-w/2, y-h/2, w, h) /* bbox & anchor */
            ctx.restore()
          }
        }
        ctx.restore()
        if (canvas.render.axis === "front") renderAxis()
        ctx.restore()

        if (anim.isPaused)
          anim.forceRender = false // clear force flag
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
      anim.forceRender = true
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

  if (canvas.anims.includes(animstate as AnimState)) return

  if (animstate instanceof Array){
    animstate.forEach(a=> addAnimState(canvas, a, loaders))
    return
  }
  if (!(animstate instanceof AnimState)){
    animstate = new AnimState(animstate)
  }
  // object type is consumed
  (animstate as AnimState).registerLoaders({...defaultLoaders, ...loaders} as any)
  canvas.anims.push(animstate as AnimState)
}

// const getImgIndex = (imgList: ImageData[], index: number): number=> {
//   let result = 0
//   imgList.forEach((img, i)=> {
//     if (img.index <= index) result = i
//   })
//   return result
// }

/** bisearch the actual image index to render */
const getImgIndex = (imgList: ImageData[], index: number): number=> {
  if (imgList.length === 1) return 0
  let i = 0, j = Math.min(index, imgList.length - 1)
  if (imgList[j].index < index) return j
  if (imgList[0].index > 0 && imgList[0].index >= index) return 0
  for (let n = 0; n < 1000; ++n){
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