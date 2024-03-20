import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"
import { FmodPlayingInfo } from "../../components/AppFmodHandler"

export interface AppStates {
  /** this flag changes to `true` after predict has been ready */
  predict_init_flag: boolean,
  /** fmod playing info */
  fmod_playing_info: {[K: string]: FmodPlayingInfo},
  /** entry tags */
  entry_tags: [string, string][],
}

const appstates = createSlice<AppStates, SliceCaseReducers<AppStates>>({
  name: "appstates",
  initialState: {
    predict_init_flag: false,
    fmod_playing_info: {},
    entry_tags: [],
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