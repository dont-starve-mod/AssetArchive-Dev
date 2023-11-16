import React from "react"
import { Routes, Route } from "react-router-dom"
import AnimRendererPage from "./pages/AnimRendererPage"
import FFmpegInstaller from "./pages/FFmpegInstaller"

export default function SubRoutes() {
  return <Routes>
    <Route path="/anim/:id" element={<AnimRendererPage/>} />
    <Route path="/ffmpeg-installer" element={<FFmpegInstaller/>} />
    <Route path="/" element={<></>} />
  </Routes>
}