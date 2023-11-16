import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"
import { FmodPlayingInfo } from "../../components/AppFmodHandler"

export interface AppStates {
  /** this flag changes to `true` after predict has been ready */
  predict_init_flag: boolean,
  /** fmod playing info */
  fmod_playing_info: {[K: string]: FmodPlayingInfo},
  /** fmod sound params (percent [0,1]) */
  fmod_param_value: {[K: string]: number},
}

const appstates = createSlice<AppStates, SliceCaseReducers<AppStates>>({
  name: "appstates",
  initialState: {
    predict_init_flag: false,
    fmod_playing_info: {},
    fmod_param_value: {
      intensity: 1,
      param00: 0.5,
      param01: 0.5,
      param02: 0.5,
    }
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