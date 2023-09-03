import SearchResultPage from "./pages/SearchResultPage"
import SettingsPage from "./pages/SettingsPage"
import AboutPage from "./pages/AboutPage"
import ReportBugPage from "./pages/ReportBugPage"
import AssetPage from "./pages/AssetPage"

import { Router, useLocation } from "react-router-dom"
import React from "react"

const MainRouteList = [
  { path: "/settings", element: <SettingsPage/> },
  { path: "/about", element: <AboutPage/> },
  { path: "/asset", element: <AssetPage/> },
  { path: "/report-bug", element: <ReportBugPage/> },
  { path: "/modtools", element: <>什么都没有</>},
  { path: "/filter", element: <>什么都没有</>},
  { path: "/", element: <></> },
]

function Test() {
  return <input placeholder="输入文本"></input>
}

function CacheRouteComponent() {
  return <></>
  // return <Router>
  //   <CacheSwitch>
  //     <CacheRoute exact path="/test" component={Test} />
  //   </CacheSwitch>
  // </Router>
}

function Route2(props){
  const {path, element} = props
  const location = useLocation()
  return <div style={{display: location.pathname === path ? null : "none"}}>
    { element }
  </div>
}

const KeepAliveRouteList = ([
  { path: "/search", element: <SearchResultPage/> },
]).map(({path, element})=> {
  MainRouteList.push({path, element: <>{console.log(`Route ${path} is keep-alive`)}</>})
  return <Route2 path={path} element={element}/>
})

export { MainRouteList, KeepAliveRouteList, CacheRouteComponent }