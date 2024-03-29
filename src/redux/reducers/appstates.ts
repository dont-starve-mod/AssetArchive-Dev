import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"
import { FmodPlayingInfo } from "../../components/AppFmodHandler"

export interface AppStates {
  /** this flag changes to `true` after predict has been ready */
  predict_init_flag: boolean,
  /** fmod playing info */
  fmod_playing_info: {[K: string]: FmodPlayingInfo},
  /** selected entry tags */
  entry_tags: [string, string][],
  /** max view data */
  max_view_data: {
    type: "tex",
    items: {xml: string, tex: string}[],
  } | {
    type: "none",
    items: never[],
  }
  max_view_open: {uid: string, index: number},
}

const appstates = createSlice<AppStates, SliceCaseReducers<AppStates>>({
  name: "appstates",
  initialState: {
    predict_init_flag: false,
    fmod_playing_info: {},
    entry_tags: [],
    max_view_data: { type: "none", items: [] },
    max_view_open: {uid: "", index: NaN},
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