import { createSlice } from "@reduxjs/toolkit"

interface ICachePayload {
  id: string,
  scrollTop: number
}

interface IPopPayload {
  id: string
}

const articlescroll = createSlice({
  name: "articlescroll",
  initialState: {},
  reducers: {
    cache(state, action: {payload: ICachePayload}){
      const {id, scrollTop} = action.payload
      state[id] = scrollTop
    },
    pop(state, action: {payload: IPopPayload}){
      const {id} = action.payload
      state[id] = undefined
    }
  }
})

export const { cache, pop } = articlescroll.actions
export default articlescroll.reducer