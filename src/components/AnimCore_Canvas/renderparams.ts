type affine_matrix = [number, number, number, number, number, number]

type Placement = {
  width: number,
  height: number,
  x: number,
  y: number,
  scale: number,
}

export interface IRenderParams {
  globalScale?: number,
  defaultScale?: number,
  axis?: "none" | "front" | "back",
  centerStyle?: "center" | "ground" | "bottom" | "origin",
  bgcType?: "solid" | "transparent",
  bgc?: string,
}

/**
 * Affect canvas render behavior, but not assiciated with AnimState
 * eg. scale / rotation / flip / xy-offset / axis / bgc
 */
export class RenderParams implements IRenderParams{
  private _scale = 1.0 // TODO: scaleX & scaleY
  MAX_SCALE = 4.0 // TODO: change scale range min max
  MIN_SCALE = 0.1
  private _rotation = 0
  private _flipV = false
  private _flipH = false
  private _x = 0
  private _y = 0
  
  globalScale = 1.0
  axis = "none" as IRenderParams["axis"]
  centerStyle = "ground" as IRenderParams["centerStyle"]
  bgcType = "solid"as IRenderParams["bgcType"]
  bgc = "#cccccc"

  _transform: affine_matrix | null = null

  canDrag = true
  canScroll = true
  canHighlight = true

  devicePixelRatio: number

  constructor(data: IRenderParams = {}){
    this.devicePixelRatio = window.devicePixelRatio || 1
    // init values
    if (data.globalScale !== undefined)
      this.globalScale = data.globalScale
    if (data.bgc !== undefined)
      this.bgc = data.bgc
    if (data.axis !== undefined)
      this.axis = data.axis
    if (data.centerStyle !== undefined)
      this.centerStyle = data.centerStyle
    if (data.defaultScale !== undefined)
      this.scale = data.defaultScale 
  }

  // getter & setter
  get scale(){ return this._scale }
  set scale(v){ this._scale = v; this.transform = null }
  get rotation(){ return this._rotation }
  set rotation(v){ this._rotation = v; this.transform = null }
  get flipV(){ return this._flipV }
  set flipV(v){ this._flipV = v; this.transform = null }
  get flipH(){ return this._flipH }
  set flipH(v){ this._flipH = v; this.transform = null } 
  get x(){ return this._x }
  set x(v){ this._x = v; this.transform = null }
  get y(){ return this._y }
  set y(v){ this._y = v; this.transform = null }

  get transform(): affine_matrix{
    if (!this._transform){
      const scaleX = this.globalScale* this.scale
      const scaleY = this.globalScale* this.scale
      this._transform = [
        scaleX * (this.flipH ? -1 : 1), 0,
        0, scaleY * (this.flipV ? -1 : 1),
        this.x, this.y
      ]
      if (Math.abs(this.rotation) > 1e-4){
        let cos = Math.cos(this.rotation)
        let sin = Math.sin(this.rotation)
        this._transform[0]*= cos
        this._transform[1]= sin* scaleX* (this.flipV ? -1 : 1)
        this._transform[2]= -sin* scaleY* (this.flipH ? -1 : 1)
        this._transform[3]*= cos
      }
    }
    return this._transform 
  }
  set transform(v: affine_matrix | null){ this._transform = v }

  offset(x: number = 0, y: number = 0){
    this.x += x // window.devicePixelRatio * this.devicePixelRatio
    this.y += y // window.devicePixelRatio * this.devicePixelRatio
  }

  reset(): void {
    this.x = 0
    this.y = 0
    this.scale = 1
  }

  axisOrigin(): [number, number] {
    const t = this.transform
    return [t[4], t[5]]
  }

  scroll(y: number){
    const scale = this.scale * Math.pow(.99, y*0.5) // TODO: 根据系统类型决定滚动方向
    this.scale = Math.min(this.MAX_SCALE, Math.max(this.MIN_SCALE, scale))
    // console.log("scaleTo", this.scale)
  }

  applyPlacement(placement: Placement) {
    this.reset()
    this.x = placement.x
    this.y = placement.y
    this.globalScale = placement.scale * 0.9
  }

  serialize() {
    return {
      bgc: this.bgcType === "transparent" ? this.bgcType : this.bgc,
      facing: undefined,
      fps: undefined,
    }
  }
}