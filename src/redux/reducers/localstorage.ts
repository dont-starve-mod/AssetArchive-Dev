// localStorage
import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"

export type BankSort = "name.a-z" | "name.z-a" | "0-9" | "9-0" | "path.a-z" | "path.z-a" | (string & {}) // facing-0|1|..255
type BankFilter = "-pre" | "-pst" | "-pre/pst" |  "-lag"
export type FevSort = "path.a-z" | "path.z-a" | "project.a-z" | "project.z-a" | "len.0-9" | "len.9-0" | "len.loop" | 
  "category.sfx" | "category.music" | "category.amb" | "no-param" | (string & {}) // param-xxx|yyyy
type FevFilter = "-empty"
type MultipleXmlSort = "name.a-z" | "name.z-a" | 
  "res.width.9-0" | "res.width.0-9" | "res.height.9-0" | "res.height.0-9" | (string & {}) // xml-path/to/xml
type MultipleXmlFilter = "-deprecated"

export type LocalStorage = {
  num_search_results_per_page: number,
  xml_display_mode: "grid" | "list" | "atlas",
  atlas_view_show_border: boolean,
  atlas_view_show_uvbox: boolean,
  tex_maximized: boolean,
  tex_use_grid_background: boolean,
  animlist_sorting: "title.a-z" | "title.z-a" | "mtime.9-0",
  quicklook_presets: {[K: string]: boolean},
  quicklook_presets_shown: {[K: string]: boolean},
  quicklook_pin_player_widget: boolean,
  bank_sort_strategy: BankSort[],
  bank_filter_strategy: BankFilter[],
  fev_sort_strategy: FevSort[],
  fev_filter_strategy: FevFilter[],
  multiple_xml_sort_strategy: MultipleXmlSort[],
  multiple_xml_filter_strategy: MultipleXmlFilter[],
  entry_filter_unfold: {[K: string]: boolean},
  entry_filter_selected: {[K: string]: boolean},
  fx_filter_selected: {[K: string]: boolean},
  debug_filter_desc: boolean,
  fmod_param_value: {[K: string]: number}, // 0-1 percent
  toast_max_num: number,
  toast_alive_time: number,
} & {
  anim_panel_bgc_type: "transparent" | "solid",
  anim_panel_color_value: string,
  anim_panel_axis: "none" | "front" | "back",
  anim_export_format: "gif" | "mov" | "png" | "mp4",
  anim_export_bgc_type: "use_current" | "transparent" | "solid",
  anim_export_color_value: string,
  anim_export_resolution: number,
  anim_export_framerate: number,
}

type Key = keyof LocalStorage

const NAMESPACE = "asset-archive-storage"

const loadPersistant = ()=> {
  try {
    const data = JSON.parse(window.localStorage.getItem(NAMESPACE))
    return data
  }
  catch(e){
    return {}
  }
}

const savePersistant = (data: LocalStorage)=> {
  window.localStorage.setItem(NAMESPACE,
    JSON.stringify(data))
}

const defaultFmodParam = {
  intensity: 1,
  nightmare: 1,
  sanity: 1,
  size: 1,
  pitch: 0,
}

const localstorage = createSlice<LocalStorage, SliceCaseReducers<LocalStorage>>({
  name: "localstorage",
  initialState: ()=> ({
    num_search_results_per_page: 200,
    xml_display_mode: "grid",
    atlas_view_show_border: true,
    atlas_view_show_uvbox: true,
    tex_maximized: false,
    tex_use_grid_background: false,
    animlist_sorting: ["mtime", true],
    quicklook_presets: {spear: true},
    quicklook_presets_shown: {},
    quicklook_pin_player_widget: false,
    bank_sort_strategy: [],
    bank_filter_strategy: [],
    fev_sort_strategy: [],
    fev_filter_strategy: [],
    multiple_xml_sort_strategy: [],
    multiple_xml_filter_strategy: [],
    entry_filter_unfold: {},
    entry_filter_selected: {},
    fx_filter_selected: {},
    debug_filter_desc: false,
    fmod_param_value: defaultFmodParam,
    toast_max_num: 5,
    toast_alive_time: 7,

    anim_panel_axis: "back",
    anim_panel_bgc_type: "solid",
    anim_panel_color_value: "#cccccc",
    anim_export_format: "gif",
    anim_export_bgc_type: "use_current",
    anim_export_color_value: "#cccccc",
    anim_export_framerate: 30,
    anim_export_resolution: 1,

    ...loadPersistant()
  }),
  reducers: {
    init: (state, action: PayloadAction<LocalStorage>)=> {
      return {
        ...state,
        ...action.payload,
      }
    },
    update: <T extends Key>(
      state: LocalStorage, 
      action: PayloadAction<{key: T, value: LocalStorage[T]}>)=>
    {
      const {key, value} = action.payload
      state[key] = value
      savePersistant(state)
    }
  }
})

export const { init, update } = localstorage.actions
export default localstorage.reducer