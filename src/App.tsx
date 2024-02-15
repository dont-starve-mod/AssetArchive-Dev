import React, { useContext, useEffect, useRef } from 'react'
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
import type { AllAssetTypes, Shader } from './searchengine'
import type { Xml, Tex, AnimDyn, AnimZip, TexNoRef, FmodEvent, FmodProject } from './searchengine'
import MyTest from './components/MyTest'
import AppFmodHandler from './components/AppFmodHandler'
import AppFirstLaunch from './components/AppFirstLaunch'
FocusStyleManager.onlyShowFocusOnTabs()

// https://zhuanlan.zhihu.com/p/573735645

declare global {
	interface Window {
		app_init?: boolean,
		assets: {
			allxmlfile: Xml[],
			alltexelement: Tex[],
			alldynfile: AnimDyn[],
			allzipfile: AnimZip[],
			alltexture: TexNoRef[],
			allkshfile: Shader[],
			allfmodevent: FmodEvent[],
			allfmodproject: FmodProject[],
		}
		assets_map: {[K: string]: AllAssetTypes},
		hash: Map<number, string>,
	}
}

window.assets_map = {}

export default function App() {
	// return <AppFirstLaunch/>
	const isSubwindow = getCurrent().label !== "main"
	// const isSubwindow = true
	return !isSubwindow ? <AppMain/> : <AppSub/>
}

function AppMain() {
	const articleRef = useRef<HTMLDivElement>(null)
	const { setScrollableWidget } = useContext(cacheContext)

	useEffect(()=> {
		setScrollableWidget({node: articleRef.current})
	}, [])

	const [theme] = useAppSetting("theme")
	const [systemTheme] = useAppSetting("systemTheme")
	const isDarkMode = (theme === "auto" ? systemTheme : theme) === "dark"

  return (
		<div className={isDarkMode ? "bp4-dark": undefined}>
			<header>
				<div onMouseDown={()=> appWindow.startDragging()}></div>
				<div>
					<Nav/>
				</div>
			</header>
			<div className="main">
				<menu>
					<MainMenu/>
				</menu>
				<article ref={articleRef} id="app-article">
					<MainRoutes/>
					<MyTest/>
				</article>
			</div>
			<footer>
				<Footer/>
			</footer>

			<AppInit/>
			<AppToaster top={40}/>
			<AppQuickSettings/>
			<AppFmodHandler/>
		</div>
	)
}

function AppSub() {
	return <SubRoutes/>
}