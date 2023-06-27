import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import { emit, listen } from '@tauri-apps/api/event'

import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [root, setRoot] = useState("")

  useEffect(()=> {
    const unlisten = listen("index_progress", ({event, payload})=> {
      console.log(event, payload)
    })
    
    return ()=> unlisten.then(f=> f())
  }, [])

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  async function mySum() {
    let r = await invoke("lua_call", { api: "sum", param: JSON.stringify([1,2,3,4])})
    // window.alert("Lua运算结果: "+r)
  }

  async function pushRoot() {
    invoke("lua_call", { api: "setroot", param: JSON.stringify(root)}).then(
      r=> console.log(r),
      e=> console.warn(e),
    )
  }

  async function luaConsole() {
    let r = await invoke("lua_console", { script: name })
    setGreetMsg(r)
  }


  const [percent, setPercent] = useState(-1)
  const update = ()=> {
    invoke("lua_call_async", {api: "getstate", param: JSON.stringify("index_progress")})
    .then(
      res=> setPercent(res),
      err=> console.log(err)
    )
  }

  const abort = ()=> {
    invoke("lua_interrupt", {})
  }

  return (
    <div className="container">
      <h1>Welcome to Tauri!</h1>

      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <div className="row">
        <form>
          <input
            id="greet-input"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="执行Lua脚本"
          />
          <button type="submit" onClick={e=> {e.preventDefault(); luaConsole()}}>RUN</button>
          <br/>
          <input
            id='root-path'
            onChange={e=> setRoot(e.currentTarget.value)}
            placeholder="设置根目录"
          />
          <button type="submit" onClick={
            e=> {
              e.preventDefault()
              pushRoot()
            }
          }>Set</button>
        </form>
      </div>

      <button style={{display: "inline-block"}} onClick={abort}>中断</button>

      <p>{greetMsg}</p>
    </div>
  );
}

export default App;
