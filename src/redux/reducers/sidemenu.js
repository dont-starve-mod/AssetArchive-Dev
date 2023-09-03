import { createSlice } from "@reduxjs/toolkit"

/* 侧边栏组件相关操作 */
const sidemenu = createSlice({
  name: "sidemenu",
  initialState: {event: "", counts: [], focus: ""},
  reducers: {
    setCounts(state, action){
      const counts = action.payload
      state.counts = counts
    },
    pushEvent(state, action){
      const event = action.payload
      state.event = event
    },
    onChangeFocus(state, action){
      state.focus = action.payload
    }
  }
})

export const {setCounts, pushEvent, onChangeFocus} = sidemenu.actions
export default sidemenu.reducer