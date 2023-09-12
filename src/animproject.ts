import { Api } from "./components/AnimCore_Canvas/animstate"
export { Api }

export interface AnimProject {
  id: string,
  title?: string,
  description?: string,
  mtime?: number,
  cmds: Api[],
  preview_scale? :number,
  facing?: string | number,
  data?: {[K: string]: any}
}
export interface NewAnimProject extends Pick<AnimProject, "title" | "description"> {}