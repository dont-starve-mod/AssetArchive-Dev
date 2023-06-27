import SettingsPage from "./pages/SettingsPage"
import AboutPage from "./pages/AboutPage"
import ReportBugPage from "./pages/ReportBugPage"
import AssetPage from "./pages/AssetPage"

const MainRouteList = [
  { path: "/settings", element: <SettingsPage/> },
  { path: "/about", element: <AboutPage/> },
  { path: "/asset", element: <AssetPage/> },
  { path: "/report-bug", element: <ReportBugPage/> },
  { path: "/modtools", element: <>什么都没有</>},
  { path: "/filter", element: <>什么都没有</>},
  { path: "/", element: <></> },
]

export { MainRouteList }