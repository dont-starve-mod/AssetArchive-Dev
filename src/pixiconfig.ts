import { settings } from "pixi.js"

settings.RESOLUTION = window.devicePixelRatio
settings.RENDER_OPTIONS = {
  ...settings.RENDER_OPTIONS,
  antialias: true,
  // premultipliedAlpha: false,
  backgroundAlpha: 0.0,
  preserveDrawingBuffer: true,
}