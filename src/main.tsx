import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "normalize.css"
// import "@blueprintjs/core/lib/css/blueprint.css"
import "./blueprint.css"
import "@blueprintjs/icons/lib/css/blueprint-icons.css"
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css"
import "./styles.css"
import { BrowserRouter } from "react-router-dom"
import store from "./redux/store"
import "./pixiconfig"
import "./polyfill"
import { Provider } from "react-redux"
import KeepAliveProvider from "./components/KeepAlive/KeepAliveProvider"
import ErrorDisplay from "./components/ErrorDisplay" 
import { ErrorBoundary } from "react-error-boundary"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorDisplay}>
      <BrowserRouter>
        <Provider store={store}>
          <KeepAliveProvider>
            <App />
          </KeepAliveProvider>
        </Provider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)