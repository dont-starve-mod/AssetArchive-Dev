import React from "react"
import { Routes, Route } from "react-router-dom"
import AnimRendererPage from "./pages/AnimRendererPage"

export default function SubRoutes() {
  return <Routes>
    <Route path="/anim/:id" element={<AnimRendererPage/>} />
    <Route path="/" element={<></>} />
  </Routes>
}