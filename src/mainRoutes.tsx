import SearchResultPage from "./pages/SearchResultPage"
import SettingsPage from "./pages/SettingsPage"
import AboutPage from "./pages/AboutPage"
import AssetPage from "./pages/AssetPage"
import AnimListPage from "./pages/AnimListPage"
import HomePage from "./pages/HomePage"
import PostProcessProjectList from "./pages/PostProcessProjectList"
import ModToolsPage from "./pages/ModToolsPage"
import AppFirstLaunch from "./components/AppFirstLaunch"
import EntrySearcher from "./components/EntrySearcher"
import QuickLookPage from "./pages/QuickLookPage"
import { Routes, Route } from "react-router-dom"

export default function MainRoutes() {
  return (
    <Routes>
      <Route path="/settings" element={<SettingsPage/>} />
      <Route path="/about" element={<AboutPage/>} />
      <Route path="/asset" element={<AssetPage/>}/>
      <Route path="/asset-group" element={<HomePage/>}/> 
      <Route path="/welcome" element={<AppFirstLaunch/>}/>
      {/* // TODO: add group data */}
      <Route path="/anim-list" element={<AnimListPage/>} />
      <Route path="/search" element={<SearchResultPage/>} />
      <Route path="/quick-look" element={<QuickLookPage/>} />
      <Route path="/mod-tools" element={<ModToolsPage/>} />
      <Route path="/entry-searcher" element={<EntrySearcher/>} />
      <Route path="/filter" element={<PostProcessProjectList/>} />
      <Route path="/" element={<HomePage/>} />
    </Routes>
  )
}