import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { byte2facing, facing2byte } from "../../facing"
import smallhash from "../../smallhash"
import { FrameList, AnimationData, BuildData, Rect } from "./animcore"
import { v4 as uuidv4 } from "uuid"
const appWindow = getCurrentWebviewWindow()

// TODO: 需要写一个指令覆盖/依赖关系的缓存表
type hash = string | number
type percent = number
type facing = string | number
type ApiArgType = string | boolean | number | hash | percent | null
type Color = [number, number, number, number]
type SymbolColorMap = {[K: number]: Color}
export type {hash, percent, facing, ApiArgType}

export interface BasicApi {
  name: string,
  args?: ApiArgType[],

  // ui params
  disabled?: true,
  fold?: boolean,
  uuid?: string,
}

export interface SingleStringArgApi extends BasicApi {
  name: "SetBuild" | "SetSkin" | "PlayAnimation" | "AddOverrideBuild" | "ClearOverrideBuild" | "ClearOverrideSymbol" |
    "SetPercent" | "PushAnimation",
  args: [string],
}

export interface SingleHashArgApi extends BasicApi {
  name: "SetBank" | "Show" | "Hide" | "ShowSymbol" | "HideSymbol" | "ShowLayer" | "HideLayer" 
  args: [hash],
}

export interface SetBankAndPlayAnimation extends BasicApi {
  name: "SetBankAndPlayAnimation",
  args: [hash, string],
}

export interface IgnoredApi extends BasicApi {
  name: "SetPercent" | "Pause" | "Resume" | "SetDeltaTimeMultiplier",
  args: any[],
}

export interface SymbolApi extends BasicApi {
  name: "OverrideSymbol" | "OverrideSkinSymbol",
  args: [hash, string, hash],
}

export interface ColourApi extends BasicApi {
  name: "SetMultColour" | "SetAddColour",
  args: [percent, percent, percent, percent],
}

export interface SymbolColourApi extends BasicApi {
  name: "SetSymbolMultColour" | "SetSymbolAddColour",
  args: [hash, percent, percent, percent, percent]
}

export type Api = SingleStringArgApi | SingleHashArgApi | SetBankAndPlayAnimation | SymbolApi | ColourApi | SymbolColourApi | IgnoredApi

enum _DefaultAsString {
  "SetBank", "SetBuild", "PlayAnimation", "PushAnimation", "SetSkin",
  "AddOverrideBuild", "ClearOverrideBuild",
  "HideSymbol", "ShowSymbol",
  "HideLayer", "ShowLayer",
  "Hide", "Show",
  "ClearOverrideSymbol",
}

export function getDefaultArgs(name: Api["name"]): any[] {
  if (typeof _DefaultAsString[name] === "number")
    return [""]
  else if (name === "SetMultColour")
    return [1, 1, 1, 1]
  else if (name === "SetAddColour")
    return [1, 0, 0, 1]
  else if (name === "SetSymbolMultColour")
    return ["", ...getDefaultArgs("SetMultColour")]
  else if (name === "SetSymbolAddColour")
    return ["", ...getDefaultArgs("SetAddColour")]
  else if (name === "OverrideSkinSymbol" || name === "OverrideSymbol")
    return ["", "", ""]
  else if (name === "SetBankAndPlayAnimation")
    return ["", ""]
  else if (name === "SetDeltaTimeMultiplier")
    return [1]
  else if (name === "SetPercent")
    return ["", 0]
  else if (name == "Pause" || name === "Resume")
    return []
  else 
    throw Error("default args not defined: " + name)
}

export function isUnstandardApi(name: Api["name"]): boolean {
  return ["PushAnimation",
  "SetSkin",
  "OverrideSkinSymbol",
  "SetPercent",
  "Pause",
  "Resume",
  "SetDeltaTimeMultiplier"].indexOf(name) !== -1
}

// group I
export enum SkeletonApi {
  "SetBank",
  "SetBuild",
  "SetSkin",
  "PlayAnimation",
  "SetBankAndPlayAnimation",
}

// group II
export enum SwapApi {
  "Show", 
  "Hide", 
  "ShowSymbol", 
  "HideSymbol", 
  "ShowLayer", 
  "HideLayer",
  "OverrideSymbol",
  "OverrideSkinSymbol",
  "ClearOverrideSymbol",
  "AddOverrideBuild",
  "ClearOverrideBuild",
}

// group III
export enum RenderApi {
  "SetMultColour",
  "SetAddColour",
  "SetSymbolMultColour",
  "SetSymbolAddColour",
}

const ALL_API = {
  ...SkeletonApi,
  ...SwapApi,
  ...RenderApi,
}

Object.values(ALL_API).forEach(v=> {
  if (typeof v === "string")
    getDefaultArgs(v as Api["name"])
})

const compareHash = (a: hash, b: hash)=> {
  if (typeof a === "string")
    a = smallhash(a)
  if (typeof b === "string")
    b = smallhash(b)

  return a === b
}

const getApiGroup = (name: string) => {
  if (name in SkeletonApi)
    return "SKELETON"
  else if (name in SwapApi)
    return "SWAP"
  else if (name in RenderApi)
    return "RENDER"
  else
    return "UNKNOWN"
}

type AnimStateEvent = "rebuildsymbolsource" | "rebuildtint" | "changeframelist" | "changerect" | "onupdate"

interface IData {
  bank?: hash,
  build?: string,
  animation?: string,
  facing?: facing,
}

const dummy = ()=> {}

export class AnimState {
  private _facing?: number = facing2byte("all")
  private _event: EventTarget
  private _visible: boolean
  facingList: number[]
  autoFacing = true
  autoFacingByBit = false
  forceRender = true
  thumbnailMode = false
  DEV_usingElementLoader: boolean

  animLoader: (param: {bank: hash, animation: string})=> AnimationData[] = dummy as any
  buildLoader: (param: {build: string})=> BuildData = dummy as any
  atlasLoader: (param: {build: string, sampler: number})=> ImageBitmap = dummy as any
  elementLoader?: (param: {build: string, imghash: number, index: number, thumbnailMode: boolean})=> ImageBitmap = dummy as any

  frameList: FrameList
  rect: Rect
  symbolCollection: Map<number, string | number>
  layerCollection:  Map<number, string | number>
  symbolSource: {[K: number]: [BuildData | null, number]}
  tint: {mult: Color, add: Color, symbolMult: SymbolColorMap, symbolAdd: SymbolColorMap}
  private player: AnimPlayer

  private api_list: Api[]

  constructor(data?: IData){
    this.api_list = []
    this.frameList = []
    this.rect = {left: -1, right: 1, top: -1, bottom: 1}
    this.symbolSource = {}
    this.symbolCollection = new Map()
    this.layerCollection = new Map()
    this.tint = {
      mult: [1,1,1,1], add: [0,0,0,0],
      symbolMult: {}, symbolAdd: {}
    }
    this.player = new AnimPlayer(this)
    this._event = new EventTarget()

    const {bank, build, animation, facing} = data || {}
    if (build !== undefined)
      this.insert({name: "SetBuild", args: [build]})
    if (bank !== undefined)
      this.insert({name: "SetBank", args: [bank]})
    if (animation !== undefined)
      this.insert({name: "PlayAnimation", args: [animation]})

    this.facing = facing
    this.facingList = []

    // debug handlers
    Object.keys(ALL_API).forEach((key)=> {
      if (isNaN(Number(key))){
        // string key
        this[key] = (...args: ApiArgType[])=> {
          // @ts-ignore
          this.insert({name: key, args})
        }
      }
    })

    this.DEV_usingElementLoader = true
    this.visible = false
  }

  // alias
  get build(){ return this.getActualBuild() }
  get bank(){ return this.getActualBank() }
  get animation() { return this.getActualAnimation() }
  get facing(): number { return this._facing }
  set facing(v: facing) { this._facing = facing2byte(v) }

  get visible() { return this._visible }
  set visible(v: boolean) { this._visible = v }

  setVisible(v: boolean) { 
    this.visible = v 
  }

  getApiList() {
    return this.api_list
  }

  setApiList(list: Api[]) {
    this.api_list = list
    this.rebuildTint()
    this.rebuildSymbolSource()
    this.forceRender = true
  }

  getValidApiList() {
    return this.api_list.filter(v=> !v.disabled)
  }

  // api handlers
  insert(api: Api, index?: number): this {
    if (api.uuid === undefined)
      api.uuid = uuidv4() // generate a new uuid  for React key
    if (typeof index == "number")
      this.api_list.splice(index, 0, api)
    else
      this.api_list.push(api)
    this.reviewApi(api)
    return this
  }

  enableApi(index: number): this {
    const api = this.api_list[index]
    api.disabled = undefined
    this.reviewApi(api)
    return this
  }

  disableApi(index: number): this {
    const api = this.api_list[index]
    api.disabled = true
    this.reviewApi(api)
    return this
  }

  deleteApi(index: number): this {
    const list = this.api_list.splice(index, 1)
    this.reviewApi(list[0])
    return this
  }

  toggleFoldApi(index: number): boolean {
    const api = this.api_list[index]
    api.fold = !api.fold
    // return current unfold state
    return !api.fold
  }

  changeApiArg(index: number, args: any): this {
    const api = this.api_list[index]
    api.args = args
    this.reviewApi(api)
    return this
  }

  rearrange(from: number, to: number): this {
    if (from === to) return this
    const len = this.api_list.length
    if (from < 0 || to < 0)
      throw Error(`Invalid index (must be positive, got ${from} & ${to})`)
    if (from > len || to > len)
      throw Error(`Invalid index (From = ${from}, To = ${to})`)
    if (from > to) {
      const [api] = this.api_list.splice(from, 1)
      this.insert(api, to)
      return this
    }
    else {
      const [api] = this.api_list.splice(from, 1)
      this.insert(api, to - 1)
      return this
    }
  }

  clear(): this {
    this.api_list.splice(0, this.api_list.length)
    return this
  }

  runCmds(cmds: Api[]): this {
    cmds.forEach(c=> this.insert(c))
    return this
  }

  private reviewApi(api: Api): this {
    const {name} = api
    const type = getApiGroup(name)
    switch (type){
      case "SKELETON":
        return this.preload(api)
          .rebuildFrameList()
          .rebuildSymbolSource()
      case "SWAP":
        return this.preload(api)
          .rebuildSymbolSource()
      case "RENDER": 
        return this.rebuildTint()
      case "UNKNOWN":
        console.warn("Unknown api group for: " + name)
        return this
    }
  }

  private preload(api: Api): this {
    if (api.disabled) return this
    const {name, args} = api
    if (name.startsWith("Show") || name.startsWith("Hide")){
      return this
    }
    if (name === "ClearOverrideBuild" || name === "ClearOverrideSymbol"){
      return this
    }
    if (name === "OverrideSymbol" || name === "OverrideSkinSymbol"){
      this.buildLoader({build: args[1]})
      return this
    }
    if (name === "SetBank" || name === "PlayAnimation" || name === "SetBankAndPlayAnimation"){
      const bank = this.getActualBank()
      const animation = this.getActualAnimation()
      if (bank && animation){
        this.animLoader({bank, animation})
      }
      return this
    }
    if (name === "SetBuild" || name === "SetSkin" || name === "AddOverrideBuild"){
      this.buildLoader({build: args[0]})
      return this
    }

    throw Error("unreachable: api name = " + name)
  }

  setFrameList(frameList: FrameList) {
    if (this.frameList !== frameList){
      this.frameList = frameList
      this.rebuildSymbolSource()
      this._event.dispatchEvent(new Event("changeframelist"))
      this.forceRender = true
    }
  }

  setRect(rect: Rect) {
    const {left, right, top, bottom} = this.rect
    if (rect.left !== left || rect.right !== right || rect.top !== top || rect.bottom !== bottom){
      this.rect = rect
      this._event.dispatchEvent(new Event("changerect"))
    }
  }

  get hasFrameList(): boolean {
    return Array.isArray(this.frameList) && this.frameList.length > 0
  }

  getActualBuild(): string | undefined {
    for (let i = this.api_list.length - 1; i >= 0; --i){
      const {name, args, disabled} = this.api_list[i]
      if (!disabled){
        if (name === "SetBuild" || name === "SetSkin")
          return args[0]
      }
    }
  }

  getActualBank(): hash | undefined {
    for (let i = this.api_list.length - 1; i >= 0; --i){
      const {name, args, disabled} = this.api_list[i]
      if (!disabled){
        if (name === "SetBank" || name === "SetBankAndPlayAnimation")
          return args[0]
      }
    }
  }

  getActualAnimation(): string | undefined {
    for (let i = this.api_list.length - 1; i >= 0; --i){
      const {name, args, disabled} = this.api_list[i]
      if (!disabled){
        if (name === "PlayAnimation" || name === "PushAnimation" || name === "SetPercent")
          return args[0]
        if (name === "SetBankAndPlayAnimation")
          return args[1]
      }
    }
  }

  getActualAnimData(animList: AnimationData[]): AnimationData | undefined {
    const anim = animList.find(a=> a.facing === this.facing)
    this.facingList = animList.map(a=> a.facing)
    if (anim !== undefined)
      return anim
    else if (this.autoFacingByBit){
      let code = 1
      while (code < 256) {
        for (let facing of this.facingList){
          if ((facing & code) > 0)
            return animList.find(a=> a.facing === facing)
        }
        code <<= 1
      }
    }
    else if (this.autoFacing)
      return animList[0]
    else
      return undefined
  }

  getActualFacing(): number {
    if (this.facingList){
      if (this.facingList.indexOf(this.facing) !== -1)
        return this.facing
      else if (this.autoFacing)
        return this.facingList[0]
    }
    return -1
  }

  getTint() {
    return this.tint
  }

  getSymbolActualTint(symbol: number) {
    let {mult, add, symbolMult, symbolAdd} = this.getTint()
    if (symbolMult[symbol]) {
      mult = mult.map((c, i)=> c * symbolMult[symbol][i]) as Color
    }
    if (symbolAdd[symbol]){
      add = add.map((c, i)=> i === 3 ? 1 : (
        c * add[3] + symbolAdd[symbol][i] * symbolAdd[symbol][3]
      )) as Color
    }
    return {mult, add}
  }

  getPreviewTint() {
    let {mult, add} = this.getTint()
    return {mult, add}
  }

  shouldRender({imghash, layerhash}: {imghash: hash, layerhash: hash}): boolean {
    let result = true
    this.api_list.forEach(({name, args, disabled})=> {
      if (disabled) return
      if (name === "Show" || name === "ShowLayer"){
        if (compareHash(args[0], layerhash)) result = true
      }
      else if (name === "Hide" || name === "HideLayer"){
        if (compareHash(args[0], layerhash)) result = false
      }
      else if (name === "ShowSymbol"){
        if (compareHash(args[0], imghash)) result = true
      }
      else if (name === "HideSymbol"){
        if (compareHash(args[0], imghash)) result = false
      }
    })
    return result
  }

  onBuildLoaded(): void {
    this.rebuildSymbolSource()
  }

  rebuildTint(): this {
    let mult: Color
    let add: Color
    let symbolMult: {[K: number]: Color} = {}
    let symbolAdd: {[K: number]: Color} = {}
    for (let i = this.api_list.length - 1; i >= 0; --i){
      const {name, args, disabled} = this.api_list[i]
      if (!disabled){
        if (name === "SetMultColour" && !mult)
          mult = args
        else if (name === "SetAddColour" && !add)
          add = args
        else if (name === "SetSymbolMultColour"){
          const hash = smallhash(args[0])
          if (!symbolMult[hash]) symbolMult[hash] = args.slice(1) as Color
        }
        else if (name === "SetSymbolAddColour"){
          const hash = smallhash(args[0])
          if (!symbolAdd[hash]) symbolAdd[hash] = args.slice(1) as Color
        }
      }
    }
    this.tint = {
      mult: mult || [1,1,1,1], 
      add:  add  || [0,0,0,1], 
      symbolMult, symbolAdd
    }
    this._event.dispatchEvent(new Event("rebuildtint"))
    this.forceRender = true
    return this
  }

  rebuildFrameList(): this {
    const animList: AnimationData[] = this.animLoader({bank: this.bank, animation: this.animation})
    if (animList && animList.length){
      const animData = this.getActualAnimData(animList)
      if (animData) {
        this.setFrameList(animData.frame)
      }
    }
    return this
  }

  rebuildSymbolSource(): this {
    // TODO: 当loadBuild获取新材质时，应该触发一次rebuild  (确认机制运行正常)
    if (this.frameList === undefined) return this
    // get all symbols / layers used in animation
    this.symbolCollection = new Map()
    this.layerCollection = new Map()
    this.frameList.forEach(frame=>
      frame.forEach(element=> {
        this.symbolCollection.set(element.imghash, -1)
        this.layerCollection.set(element.layerhash, -1)
      }))
    // try to resolve hash
    for (let map of [this.symbolCollection, this.layerCollection]) {
      for (let key of map.keys()) {
        const string = window.hash.get(key)
        if (typeof string === "string") {
          map.set(key, string)
        }
      }
    }
    // iter cmds
    this.symbolSource = Object.fromEntries(
      Array.from(this.symbolCollection.keys()).map(symbol=> [symbol, [null, -1]]))
    this.api_list.forEach(api=> {
      if (api.disabled) return
      const {name, args} = api
      if (name === "AddOverrideBuild" || name === "ClearOverrideBuild") {
        const buildData = this.buildLoader({build: args[0]})
        if (buildData) {
          buildData.symbol.forEach(symbol=> {
            const hash = symbol.imghash
            if (!this.symbolSource[hash]) return
            this.symbolSource[hash] = name === "AddOverrideBuild" ? [
              buildData,
              hash,
            ] : [null, -1]
          })
        }
      }
      else if (name === "OverrideSymbol" || name === "OverrideSkinSymbol") {
        const buildData = this.buildLoader({build: args[1]})
        if (buildData) {
          const hash = smallhash(args[0]) // symbol to be swapped
          const sourceSymbol = smallhash(args[2])
          if (this.symbolSource[hash] !== undefined && buildData.symbolMap[sourceSymbol] !== undefined) {
            this.symbolSource[hash] = [buildData, sourceSymbol]
          }
        }
      }
      else if (name === "ClearOverrideSymbol") {
        const hash = smallhash(args[0])
        this.symbolSource[hash] = [null, -1]
      }
    })
    this._event.dispatchEvent(new Event("rebuildsymbolsource"))
    this.forceRender = true
    return this
  }

  getSourceBuild(imghash: hash): [BuildData | null, number] {
    const hash = smallhash(imghash)
    if (this.symbolSource[hash] && this.symbolSource[hash][0]) 
      return this.symbolSource[hash]
    if (typeof this.build === "string")
      return [this.buildLoader({build: this.build}) || null, hash]

    return [null, -1]
  }

  // loaders
  registerLoaders({animLoader, buildLoader, atlasLoader, elementLoader}){
    this.animLoader = animLoader
    this.buildLoader = buildLoader
    this.atlasLoader = atlasLoader
    this.elementLoader = elementLoader

    if (elementLoader !== undefined){
      // register global element loaded listener
      appWindow.listen<{imghash: number}>("animation_element_loaded", ({payload})=> {
        if (this.forceRender) return
        if (this.symbolCollection.has(payload.imghash) ||
          Object.values(this.symbolSource)
          .some(([_, hash])=> hash === payload.imghash)){
          this.forceRender = true
        }
      })
      // TODO: remove this listener on ~AnimState?
    }
  }

  // event
  addEventListener(type: AnimStateEvent, callback: EventListenerOrEventListenerObject) {
    this._event.addEventListener(type, callback)
  }

  removeEventListener(type: AnimStateEvent, callback: EventListenerOrEventListenerObject) {
    this._event.removeEventListener(type, callback)
  }

  // player methods
  getPlayer(): AnimPlayer { return this.player }
  pause(): void { this.player.paused = true }
  resume(): void { this.player.paused = false }
  get isPaused(): boolean { return this.player.paused }
  get isPlaying(): boolean { return !this.player.paused }

  update(dt: number): void{
    if (this.frameList.length > 0){
      this.player.totalFrame = this.frameList.length
      this.player.update(dt)
      this._event.dispatchEvent(new Event("onupdate"))
    }
  }

  get currentFrame() { return this.player.currentFrame }
}

class AnimPlayer {
  anim: AnimState
  speed = 1
  _reversed = false
  _currentFrame = 0
  totalFrame = 0
  time = 0
  paused = false
  frameRate = 30

  constructor(anim: AnimState){
    this.anim = anim
  }

  /** time of miliseconds per frame, eg: 33(ms) */
  get frameInterval(){ return 1000/this.frameRate }

  get reversed() { return this._reversed }
  set reversed(v: boolean) {
    if (v !== this._reversed){
      this.time = this.frameInterval - this.time
    }
    this._reversed = v
  }

  get currentFrame() { return this._currentFrame }
  set currentFrame(v: number) {
    this._currentFrame = v
    this.anim.forceRender = true
  }

  update(dt: number){
    if (this.paused) return
    let time = this.time + dt* this.speed
    let f = this.currentFrame
    let i = this.frameInterval
    while(time > i){
      time -= i
      if (!this.reversed){
        f += 1
        if (f >= this.totalFrame){
           f = 0
           time = 0
           break
        }
      }
      else{
        f -= 1
        if (f < 0){
          f = this.totalFrame - 1
          time = 0
          break
        }
      }
    }
    this.currentFrame = f
    this.time = time
  }

  step(v: number){
    let f = this.currentFrame
    let dir = v > 0 ? true : false
    v = Math.abs(v)
    while (v > 0){
      v -= 1
      if (dir){
        f = f + 1 >= this.totalFrame ? 0 : f + 1
      }
      else {
        f = f - 1 < 0 ? this.totalFrame - 1 : f - 1
      }
    }
    if (f !== this.currentFrame){
      this.currentFrame = f
      this.time = 0
    }
  }

  getSmoothPercent(): number {
    if (this.totalFrame === 0) return 0
    const percentInFrame = this.time / this.frameInterval
    if (!this.reversed)
      return (this.currentFrame + percentInFrame) / this.totalFrame
    else
      return (this.currentFrame + 1 - percentInFrame) / this.totalFrame 
  }

  setPercent(percent: number, autoStop?: false){
    if (autoStop !== false)
      this.paused = true
    
    if (this.totalFrame > 0){
      const frame = percent * (this.totalFrame)
      if (!this.reversed){
        this.currentFrame = Math.min(Math.floor(frame), this.totalFrame - 1)
        this.time = (frame - this.currentFrame)* this.frameInterval
      }
      else{
        this.currentFrame = Math.min(Math.ceil(frame), this.totalFrame - 1)
        this.time = (1 + this.currentFrame - frame)* this.frameInterval
      }
    }
  }
}