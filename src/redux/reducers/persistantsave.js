import { createSlice } from '@reduxjs/toolkit'

/* 可触发状态变化的localStorage */
const initialState = {}
for (let i = 0; i < localStorage.length; ++i){
  const key = localStorage.key(i)
  const raw = localStorage.getItem(key)
  if (typeof raw === "string"){
    initialState[key] = JSON.parse(raw)
  }
}
const persistantsave = createSlice({
  name: "persistantsave",
  initialState,
  reducers: {
    onChangeLocalStorage(state, action){
      const {key, value} = action.payload
      state[key] = value
    }
  }
})

export const { onChangeLocalStorage } = persistantsave.actions
export default persistantsave.reducer
