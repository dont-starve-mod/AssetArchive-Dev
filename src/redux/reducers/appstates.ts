import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"

export interface AppStates {
  /**  this flag changes to `true` after predict has been ready */
  predict_init_flag: boolean,
  // root: string | null,
  // last_dst_root: string | null,
  // volume: number,
  // theme: "light" | "dark" | "auto",
  // resolution: "full" | "half",
  // quick_search_desc: "on" | "off",
  // num_search_results: number,
  // systemTheme: Theme, // frontend-only value
}

const appstates = createSlice<AppStates, SliceCaseReducers<AppStates>>({
  name: "appstates",
  initialState: {
    predict_init_flag: false,
  },
  reducers: {
    setState: <T extends keyof AppStates>(
      state: AppStates, 
      action: PayloadAction<{key: T, value: AppStates[T]}>)=>
    {
      const {key, value} = action.payload
      state[key] = value
    }
  }
})

export const { setState } = appstates.actions
export default appstates.reducer