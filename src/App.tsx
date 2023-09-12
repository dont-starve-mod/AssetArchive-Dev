import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Spinner } from "@blueprintjs/core"
import { Routes, useLocation, useNavigate, useRoutes, useSearchParams } from 'react-router-dom'
import { appWindow, getCurrent } from '@tauri-apps/api/window'
import { listen as globalListen } from '@tauri-apps/api/event' 
import "./App.css"

import Nav from './components/Nav'
import MainMenu from './components/MainMenu'
import Footer from './components/Footer'
import AppToaster from './components/AppToaster'

import AppInit from './components/AppInit'
import { useLuaCall } from './hooks'
import { FocusStyleManager } from "@blueprintjs/core"
import Preview from './components/Preview'
import cacheContext from './components/KeepAlive/cacheContext'
import MainRoutes from './mainRoutes'
import SubRoutes from './subRoutes'

FocusStyleManager.onlyShowFocusOnTabs()

declare global {
	interface Window {
		app_init?: boolean,
		config: any,
	}
}

export default function App() {
	const isSubwindow = getCurrent().label !== "main"
	return !isSubwindow ? <AppMain/> : <AppSub/>
}

function AppMain() {
	let url = useLocation()
	// let mainroute = useRoutes(MainRouteList)
	// console.log(mainroute)
	const navigate = useNavigate()
	const articleRef = useRef(null)
	const { setScrollableWidget } = useContext(cacheContext)

	useEffect(()=> {
		setScrollableWidget({node: articleRef.current})
	}, [])

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

  return (<div className={isDarkMode ? "bp4-dark": undefined}>
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
			<article ref={articleRef} id="app-article">
				<MainRoutes/>

				<div style={{height: 300}}></div>
				<br/>
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

function AppSub() {
	return <SubRoutes/>
}

function Local() {
	const [_, plus] = useState(0)
	useEffect(()=> {
		let t = setInterval(()=> plus(v=> v+1), 500)
		return ()=> clearInterval(t)
	}, [plus])
	return <p>{JSON.stringify(window.config)}</p>
}