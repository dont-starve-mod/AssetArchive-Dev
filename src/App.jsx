import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Spinner } from "@blueprintjs/core"
import { Routes, useLocation, useNavigate, useRoutes, useSearchParams } from 'react-router-dom'
import { appWindow } from '@tauri-apps/api/window'
import { listen as globalListen } from '@tauri-apps/api/event' 
import "./App.css"

import Nav from './components/Nav'
import MainMenu from './components/MainMenu'
import Footer from './components/Footer'
import AppToaster from './components/AppToaster'
import KeepAlivePage from './components/KeepAlive'

import AppInit from './components/AppInit'
import { useLuaCall } from './hooks'
import { FocusStyleManager } from "@blueprintjs/core"
import Preview from './components/Preview'
import cacheContext from './components/KeepAlive/cacheContext'
import MainRoutes from './mainRoutes'

FocusStyleManager.onlyShowFocusOnTabs()

export default function App() {
	let url = useLocation()
	// let mainroute = useRoutes(MainRouteList)
	// console.log(mainroute)
	const navigate = useNavigate()

	const { setScrollableWidget } = useContext(cacheContext)

	let compile = useLuaCall("debug_analyze")

	// TODO: 注意这里的颜色模式切换并不是启动即时的，可能有点问题需要优化
	const [systemTheme, setSystemTheme] = useState("light")
	const [configTheme, setConfigTheme] = useState()

	// useEffect(()=> {
		
	// 	appWindow.theme().then(
	// 		theme=> {
	// 			setSystemTheme(theme)
	// 		}
	// 	)
	// }, [setSystemTheme])

	// useEffect(()=> {
		
	// 	const configListener = appWindow.listen("colortheme", ({payload: theme})=> {
	// 		setConfigTheme(theme)
	// 	})
	// 	const systemListener = appWindow.onThemeChanged(({payload: theme})=> {
	// 		setSystemTheme(theme)
	// 	})
	// 	return ()=> {
	// 		configListener.then(f=> f())
	// 		systemListener.then(f=> f())
	// 	}
	// }, [systemTheme, setSystemTheme, configTheme, setConfigTheme])

	const isDarkMode = useMemo(()=> {
		if (configTheme === "auto") {
			return systemTheme === "dark"
		}
		else {
			return configTheme === "dark"
		}
	}, [systemTheme, configTheme])

  return (<div className={isDarkMode ? "bp4-dark": null}>
		<header>
			<div onMouseDown={async()=> await appWindow.startDragging()}></div>
			<div>
				<Nav/>
			</div>
		</header>
		<div className='main'>
			<menu>
				<MainMenu/>
			</menu>
			<article ref={(node)=> setScrollableWidget(node)}>
				<MainRoutes/>
				{
					// KeepAliveRouteList
				}
				{/* <KeepAlivePage path="/search"/> */}
				{/* <CacheRouteComponent /> */}
				
				<div style={{height: 300}}></div>
				<br/>
				<Button onClick={()=> compile()}> compile </Button>
				<Button onClick={()=> navigate("/test")}></Button>
				
				
			</article>
		</div>
		<footer>
			<Footer/>
		</footer>

		<AppInit/>
		<AppToaster/>
		
		
		{/* <Local/> */}
  </div>)
}

function Local() {
	const [_, plus] = useState(0)
	useEffect(()=> {
		let t = setInterval(()=> plus(v=> v+1), 500)
		return ()=> clearInterval(t)
	}, [plus])
	return <p>{JSON.stringify(window.config)}</p>
}