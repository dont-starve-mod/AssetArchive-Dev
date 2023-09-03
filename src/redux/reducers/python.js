import { createSlice } from '@reduxjs/toolkit'

/** python websocket server发送过来的变量
 * 注意: 这些变量在前端应当是只读的, 不要在任何其他地方修改 */
const python = createSlice({
  name: "python",
  initialState: {},
  reducers: {
    init(state, action){
      return {...state, ...action.payload}
    },
    onChange(state, action){
      const {key, value} = action.payload
      state[key] = value
    }
  }
})

export const { init, onChange } = python.actions
export default python.reducer