import { byte2facing, facing2byte } from "../../facing"
import smallhash from "../../smallhash"
import { FrameList, AnimationData, BuildData } from "./animcore"
import { v4 as uuidv4 } from "uuid"

type hash = string | number
type percent = number
type facing = string | number
type ApiArgType = string | boolean | number | hash | percent | null
export type {hash, percent, facing, ApiArgType}

export interface BasicApi {
  name: string,
  args?: ApiArgType[],
  disabled?: true,
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

interface IData {
  bank?: hash,
  build?: string,
  animation?: string,
  facing?: facing,
}

export class AnimState {
  private _facing?: facing = "all"
  autoFacing?: true

  animLoader: Function = ()=> {}
  buildLoader: ({build}: {build: string})=> BuildData | undefined = ()=> undefined
  atlasLoader: Function = ()=> {}

  frameList: FrameList
  symbolSource: {[K: number]: [BuildData | null, number]}
  private player: AnimPlayer

  private api_list: Api[]

  constructor(data?: IData){
    this.api_list = []
    this.frameList = []
    this.symbolSource = {}
    this.player = new AnimPlayer(this)

    const {bank, build, animation, facing} = data || {}
    if (build !== undefined)
      this.insert({name: "SetBuild", args: [build]})
    if (bank !== undefined)
      this.insert({name: "SetBank", args: [bank]})
    if (animation !== undefined)
      this.insert({name: "PlayAnimation", args: [animation]})

    this.facing = facing

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

    // if (window.anim === undefined) window.anim = this
  }

  // alias
  get build(){ return this.getActualBuild() }
  get bank(){ return this.getActualBank() }
  get animation() { return this.getActualAnimation() }
  get facing(){ return this._facing }
  set facing(v) { this._facing = facing2byte(v) }

  getApiList() {
    return this.api_list
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

  rearrange(from: number, to: number): this {
    console.log("rearrange!!", from, to)
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
          .rebuildSymbolSource()
      case "SWAP":
        return this.preload(api)
          .rebuildSymbolSource()
      case "RENDER": // do nothing
        return this
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
    }
  }

  getActualBuild(): string | undefined {
    for (let i = this.api_list.length - 1; i >= 0; --i){
      const {name, args, disabled} = this.api_list[i]
      if (!disabled){
        if (name === "SetBuild" || name == "SetSkin")
          return args[0]
      }
    }
  }

  getActualBank(): hash | undefined {
    for (let i = this.api_list.length - 1; i >= 0; --i){
      const {name, args, disabled} = this.api_list[i]
      if (!disabled){
        if (name === "SetBank" || name == "SetBankAndPlayAnimation")
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

  getActualFacing(animList: AnimationData[]): AnimationData | undefined {
    const anim = animList.find(a=> a.facing === this.facing)
    if (anim !== undefined)
      return anim
    else if (this.autoFacing)
      return animList[0]
    else
      return undefined
  }

  shouldRender({imghash, layerhash}: {imghash: hash, layerhash: hash}): boolean {
    let result = true
    this.api_list.forEach(({name, args})=> {
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

  rebuildSymbolSource(): this {
    // TODO: 当loadBuild获取新材质时，应该触发一次rebuild  （如何实现？）
    if (this.frameList === undefined) return this
    // get all symbols used in animation
    const hashCollection = new Set<number>()
    this.frameList.forEach(frame=>
      frame.forEach(element=> hashCollection.add(element.imghash)))
    // iter cmds
    this.symbolSource = Object.fromEntries(
      Array.from(hashCollection).map(symbol=> [symbol, [null, -1]]))
    this.api_list.forEach(api=> {
      if (api.disabled) return
      const {name, args} = api
      if (name === "AddOverrideBuild" || name === "ClearOverrideBuild") {
        const buildData = this.buildLoader({build: args[0]})
        if (buildData) {
          buildData.symbol.forEach(symbol=> {
            const hash = symbol.imghash
            if (!this.symbolSource[hash]) return
            this.symbolSource[hash] = name.startsWith("Add") ? [
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
      else if (name == "ClearOverrideSymbol") {
        const hash = smallhash(args[0])
        delete this.symbolSource[hash]
      }
    })
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
  registerLoaders({animLoader, buildLoader, atlasLoader}: {[K in keyof AnimState]: AnimState[K]}){
    this.animLoader = animLoader
    this.buildLoader = buildLoader
    this.atlasLoader = atlasLoader
  }

  // player methods
  pause(): void { this.player.paused = true }
  resume(): void { this.player.paused = false }
  get isPaused(): boolean { return this.player.paused }
  get isPlaying(): boolean { return !this.player.paused }

  update(dt: number): void{
    if (this.frameList.length > 0){
      this.player.totalFrame = this.frameList.length
      this.player.update(dt)
    }
  }

  get currentFrame() { return this.player.currentFrame }
}

class AnimPlayer {
  anim: AnimState
  speed = 1
  reversed = false
  currentFrame = 0
  totalFrame = 0
  time = 0
  paused = false
  frameRate = 30

  constructor(anim: AnimState){
    this.anim = anim
  }

  get frameInterval(){ return 1000/this.frameRate }

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
}