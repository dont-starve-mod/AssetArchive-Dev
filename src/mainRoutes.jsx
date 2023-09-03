import SearchResultPage from "./pages/SearchResultPage"
import SettingsPage from "./pages/SettingsPage"
import AboutPage from "./pages/AboutPage"
import ReportBugPage from "./pages/ReportBugPage"
import AssetPage from "./pages/AssetPage"
import withKeepAlive from "./components/KeepAlive"

import { Routes, Route, useLocation } from "react-router-dom"

export default function MainRoutes() {
  return <Routes>
    <Route path="/settings" element={<SettingsPage/>} />
    <Route path="/about" element={<AboutPage/>} />
    <Route path="/asset" element={<AssetPage/>}/>
    <Route path="/report-bug" element={<ReportBugPage/>} />
    {/* <Route path="/search" element={<SearchResultPage_Alive/>} /> */}
    <Route path="/modtools" element={<>什么都没有</>} />
    <Route path="/filter" element={<>什么都没有</>} />
    <Route path="/" element={<></>} />
  </Routes>
}