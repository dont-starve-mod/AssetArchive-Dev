import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"
import { Theme } from "@tauri-apps/api/window"

export interface AppSettings {
  root: string | null,
  last_dst_root: string | null,
  volume: number,
  theme: "light" | "dark" | "auto",
  resolution: "full" | "half",
  quick_search_desc: "on" | "off",
  num_search_results: number,
  systemTheme: Theme, // frontend-only value
}

type Key = keyof AppSettings

const appsettings = createSlice<AppSettings, SliceCaseReducers<AppSettings>>({
  name: "appsettings",
  initialState: {
    root: null,
    last_dst_root: null,
    volume: 100,
    theme: "auto",
    resolution: "full",
    quick_search_desc: "off",
    num_search_results: 1000,
    systemTheme: "light",
  },
  reducers: {
    init: (state, action: PayloadAction<AppSettings>)=> {
      return {
        ...state,
        ...action.payload,
      }
    },
    update: <T extends Key>(
      state: AppSettings, 
      action: PayloadAction<{key: T, value: AppSettings[T]}>)=>
    {
      const {key, value} = action.payload
      state[key] = value
    }
  }
})

// TODO: fix action typing...
export const { init, update } = appsettings.actions
export default appsettings.reducer