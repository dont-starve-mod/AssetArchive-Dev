import { createSlice } from "@reduxjs/toolkit"

/* 页面图片列表 */
const imagelist = createSlice({
  name: "imagelist",
  initialState: {list: [], index: -1},
  reducers: {
    setImageList(state, action){
      const list = action.payload
      /* 修剪多余的null */
      const nullIndex = list.indexOf(null)
      if (nullIndex !== -1){
        list.length = nullIndex
      }
      state.list = list
    },
    setImageIndex(state, action){
      state.index = action.payload
    },
    clearImageList(state){
      state.list = []
    },
  }
})

export const {setImageList, clearImageList, setImageIndex} = imagelist.actions
export default imagelist.reducer