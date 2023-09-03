import { createSlice } from '@reduxjs/toolkit'

const soundeventinfo = createSlice({
  name: "soundeventinfo",
  initialState: {},
  reducers: {
    onGetInfo(state, action){
      const {path, info} = action.payload
      state[path] = info
    }
  }
})

export const { onGetInfo } = soundeventinfo.actions
export default soundeventinfo.reducer