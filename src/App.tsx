import React, { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { appWindow, getCurrent } from '@tauri-apps/api/window'
import "./App.css"

import Nav from './components/Nav'
import MainMenu from './components/MainMenu'
import Footer from './components/Footer'
import AppToaster from './components/AppToaster'
import AppInit from './components/AppInit'
import { FocusStyleManager } from "@blueprintjs/core"
import cacheContext from './components/KeepAlive/cacheContext'
import MainRoutes from './mainRoutes'
import SubRoutes from './subRoutes'
import AppQuickSettings from './components/AppQuickSettings'
import { useAppSetting } from './hooks'
FocusStyleManager.onlyShowFocusOnTabs()

declare global {
	interface Window {
		app_init?: boolean,
	}
}

export default function App() {
	const isSubwindow = getCurrent().label !== "main"
	return !isSubwindow ? <AppMain/> : <AppSub/>
}

function AppMain() {
	const articleRef = useRef(null)
	const { setScrollableWidget } = useContext(cacheContext)

	useEffect(()=> {
		setScrollableWidget({node: articleRef.current})
	}, [])

	const [theme, _] = useAppSetting("theme")
	const [isDarkMode, setDarkMode] = useState(false)

	useEffect(()=> {
		appWindow.theme().then(
			systemTheme=> setDarkMode(
				theme !== "auto" ? theme === "dark" : systemTheme == "dark")
		)
	}, [theme])

  return (
		<div className={isDarkMode ? "bp4-dark": undefined}>
			<header>
				<div onMouseDown={()=> appWindow.startDragging()}></div>
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
				</article>
			</div>
			<footer>
				<Footer/>
			</footer>

			<AppInit/>
			<AppToaster/>
			<AppQuickSettings/>
		</div>
	)
}

function AppSub() {
	return <SubRoutes/>
}