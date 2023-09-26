import { configureStore } from "@reduxjs/toolkit"
import { useDispatch as oldDispatch, useSelector as oldSelector } from "react-redux"
import { TypedUseSelectorHook } from "react-redux"
import reducer from "./reducers"

const store = configureStore({
  reducer,
  // middleware: (getDefaultMiddleware)=> getDefaultMiddleware({
  //   serializableCheck: {
  //     ignoreState: true
  //   }
  // })
})

export type ReduxState = ReturnType<typeof store.getState>
export type ReduxDispatch = typeof store.dispatch
export const useDispatch: ()=> ReduxDispatch = oldDispatch
export const useSelector: TypedUseSelectorHook<ReduxState> = oldSelector

export default store