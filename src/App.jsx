import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  async function mySum() {
    let r = await invoke("lua_call", { api: "sum", param: JSON.stringify([1,2,3,4])})
    // window.alert("Lua运算结果: "+r)
  }

  async function testBytes() {
    let r = await invoke("lua_call", { api: "bytes", param: ""})
    console.log(r)
    let str = r
    for (var i = 0, j = str.length; i < j; ++i) {
      console.log(str.charCodeAt(i));
    }
  }

  async function luaConsole() {
    let r = await invoke("lua_console", { script: name })
    setGreetMsg(r)
  }

  useEffect(()=> {
    mySum()
    testBytes()
  }, [])

  return (
    <div className="container">
      <h1>Welcome to Tauri!</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <div className="row">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            luaConsole();
          }}
        >
          <input
            id="greet-input"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="执行Lua脚本"
          />
          <button type="submit">RUN</button>
        </form>
      </div>

      <p>{greetMsg}</p>
    </div>
  );
}

export default App;
