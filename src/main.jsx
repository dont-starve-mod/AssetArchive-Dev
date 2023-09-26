import "./globals.d.ts"
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
import { KeepAliveProvider } from "./components/KeepAlive"
import store from "./redux/store"
import './pixiconfig.ts'
import { Provider } from "react-redux"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <KeepAliveProvider>
          <App />
        </KeepAliveProvider>
      </Provider>
    </BrowserRouter>
  </React.StrictMode>
);
