// localStorage
import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction, SliceCaseReducers } from "@reduxjs/toolkit"

export interface LocalStorage {
  volume: number,
  num_search_results_per_page: number,
  atlas_view_show_border: boolean,
  atlas_view_show_uvbox: boolean,
  tex_maximized: boolean,
  tex_use_grid_background: boolean,
  animlist_sorting: ["mtime"|"title", boolean],
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

const localstorage = createSlice<LocalStorage, SliceCaseReducers<LocalStorage>>({
  name: "localstorage",
  initialState: ()=> ({
    num_search_results_per_page: 200,
    atlas_view_show_border: true,
    atlas_view_show_uvbox: true,
    tex_maximized: false,
    tex_use_grid_background: false,
    animlist_sorting: ["mtime", true],
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