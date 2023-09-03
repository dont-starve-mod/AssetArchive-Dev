import { createSlice } from "@reduxjs/toolkit"

/* 管理动画和材质信息 */
const animasset = createSlice({
  name: "animasset",
  initialState: {
    animLoading: {},
    animData: {},
    buildLoading: {},
    buildData: {},
    atlasLoading: {},
    atlasData: {},
  },
  reducers: {
    loadAnim(state, action){
      const {id} = action.payload
      state.animLoading = {...state.animLoading, [id]: true}
    },
    onLoadAnimData(state, action){
      const {id, data} = action.payload
      delete state.animLoading[id]
      state.animData[id] = data
    },
    loadBuild(state, action){
      const {id} = action.payload
      state.buildLoading = {...state.buildLoading, [id]: true}
    },
    onLoadBuildData(state, action){
      const {id, data} = action.payload
      delete state.buildLoading[id]
      state.buildData[id] = data
    },
    loadAtlas(state, action){
      const {id} = action.payload
      state.atlasLoading = {...state.atlasLoading, [id]: true}
    },
    onLoadAtlas(state, action){
      const {id} = action.payload
      delete state.atlasLoading[id]
      state.atlasData[id] = true
    }
  }
})

export const {
  loadAnim, onLoadAnimData, 
  loadBuild, onLoadBuildData, 
  loadAtlas, onLoadAtlas} = animasset.actions
export const actions = animasset.actions
export default animasset.reducer