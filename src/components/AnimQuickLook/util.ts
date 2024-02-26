import { v4 } from "uuid"
import smallhash from "../../smallhash"
import { DefinedPresetGroup, checkCondition } from "./preset"
import "./preset"
import { BuildData } from "../AnimCore_Canvas/animcore"
import { AnimState, Api } from "../AnimCore_Canvas/animstate"
import { useSelector } from "../../redux/store"
import { useCallback, useMemo } from "react"
import { save } from "@tauri-apps/api/dialog"
import { useLuaCall } from "../../hooks"

export function useQuickLookPresets(
  data: {bank?: string | number, animation?: string, build?: string}) {
    return useMemo(()=> {
    // NOTE: assume window.animpreset is loaded
    const result = [] as (Omit<DefinedPresetGroup, "condition">)[]
    if (data.bank !== undefined && data.animation !== undefined){
      const bankHash = smallhash(data.bank)
      // collect auto preset
      const auto = window.animpreset.auto[bankHash]
      if (Array.isArray(auto)) {
        result.push({
          key: "[BANK]"+ bankHash,
          title: "#build",
          order: -1, // at top
          presets: auto.map(build=> ({
            key: build,
            title: build,
            cmds: [{"name": "SetBuild", args: [build]}],
          }))
        })
      }
      // collect def preset
      const def = [] as (Omit<DefinedPresetGroup, "condition">)[]
      Object.values(window.animpreset.def)
        .forEach(v=> {
          const {key, title, condition, presets, order} = v
          if (checkCondition(condition, {bank: bankHash})){
            def.push({key, title, presets, order})
          }
        })
      def.toSorted((a, b)=> a.order - b.order).forEach(v=> {
        result.push(v)
      })
    }
    else if (data.build !== undefined){
  
    }

    return result
  }, [])
}

export function useQuickLookCmds(
  data: {bank: string | number, animation: string, build: string}
) {
  const stored_presets = useSelector(({localstorage})=> localstorage.quicklook_presets)
  const presets = useQuickLookPresets(data)
  return useMemo(()=> {
    const list = [] as Api[]
    console.log("??", presets)
    presets.forEach(v=> {
      const {key, presets} = v
      const preset = presets.find(v=> stored_presets[`${key}-${v.key}`]) || presets[0]
      const cmds = preset.cmds.map(v=> JSON.parse(JSON.stringify(v)))
      list.push(...cmds)
    })
    return list
  }, [stored_presets, presets])
}

type ExportFormat = "gif" | "mp4" | "snapshot"

export function useQuickLookExport(
  animstate: AnimState, defaultName?: string
) {
  defaultName = defaultName || "export"
  const call = useLuaCall("render_animation_sync", ()=> {}, {}, [])
  return useCallback(async (format: ExportFormat)=> {
    animstate.pause()
    const path = await save({
      title: "",
      defaultPath: `${defaultName}.${format === "snapshot" ? "png" : format}`
    })
    if (typeof path !== "string") throw Error("path not provided")
    if (!animstate.hasFrameList) throw Error("animation not valid")
    
    const session_id = "quicklook_export"
    call({
      session_id,
      path,
      api_list: animstate.getValidApiList(),
      render_param: {
        scale: 1.0,
        rate: 30,
        format,
        facing: animstate.getActualFacing(),
        bgc: format === "mp4" ? "#cccccc" : "transparent",
        current_frame: animstate.currentFrame,
        skip_index: true,
      }
    })
  }, [animstate, call])
}