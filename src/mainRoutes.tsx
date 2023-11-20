import React from "react"
import SearchResultPage from "./pages/SearchResultPage"
import SettingsPage from "./pages/SettingsPage"
import AboutPage from "./pages/AboutPage"
import ReportBugPage from "./pages/ReportBugPage"
import AssetPage from "./pages/AssetPage"
import AnimListPage from "./pages/AnimListPage"
import HomePage from "./pages/HomePage"

import { Routes, Route } from "react-router-dom"

export default function MainRoutes() {
  return <Routes>
    <Route path="/settings" element={<SettingsPage/>} />
    <Route path="/about" element={<AboutPage/>} />
    <Route path="/asset" element={<AssetPage/>}/>
    <Route path="/asset-group" element={<HomePage/>}/> 
    {/* // TODO: add group data */}
    <Route path="/report-bug" element={<ReportBugPage/>} />
    <Route path="/anim-list" element={<AnimListPage/>} />
    <Route path="/search" element={<SearchResultPage/>} />
    <Route path="/modtools" element={<>什么都没有</>} />
    <Route path="/filter" element={<>什么都没有</>} />
    <Route path="/" element={<HomePage/>} />
  </Routes>
}