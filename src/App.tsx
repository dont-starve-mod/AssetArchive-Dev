import { useContext, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { FocusStyleManager } from "@blueprintjs/core"
import Nav from './components/Nav'
import MainMenu from './components/MainMenu'
import Footer from './components/Footer'
import AppInit from './components/AppInit'
import AppToaster from './components/AppToaster'
import AppFmodHandler from './components/AppFmodHandler'
import AppQuickSettings from './components/AppQuickSettings'
import cacheContext from './components/KeepAlive/cacheContext'
import AppMaxView from './components/AppMaxView'
import MainRoutes from './mainRoutes'
import SubRoutes from './subRoutes'
import { useAppSetting } from './hooks'
import type { ArchiveItem, Bank, Entry, Shader, StaticArchiveItem } from './searchengine'
import type { Xml, Tex, AnimDyn, AnimZip, TexNoRef, FmodEvent, FmodProject } from './searchengine'
import type { DefinedPresetGroup } from './components/AnimQuickLook/preset'
import "./App.css"

FocusStyleManager.onlyShowFocusOnTabs()

declare global {
	interface Window {
		appWindow: WebviewWindow,
		emit: <T>(event: string, payload?: T)=> Promise<void>,
		listen: <T>(event: string, callback: (event: {payload: T})=> void)=> Promise<() => void>,
		app_init?: boolean,
		keystate: {[key: string]: boolean},
		assets: {
			allxmlfile: Xml[],
			alltexelement: Tex[],
			alldynfile: AnimDyn[],
			allzipfile: AnimZip[],
			alltexture: TexNoRef[],
			allkshfile: Shader[],
			allfmodevent: FmodEvent[],
			allfmodproject: FmodProject[],
			allstaticpage: StaticArchiveItem[],

			allbank: Bank[],
		}
		assets_map: {[id: string]: ArchiveItem},
		assets_tag: {[tag: string]: {[id: string]: ArchiveItem}},
		entry: Entry[],
		entry_map: {[K: string]: Entry},
		animpreset: {
			def: {
				[K: string]: DefinedPresetGroup,
			},
			auto: {
				[K: number]: string[],
			}
		}
		hash: Map<number, string>,
		max_view_data: {
			[uid: string]: {type: string, items: any[]},
		},

		text_guard: string,
		show_debug_tools: boolean,
		filepath?: string, // only in quicklook
		filename?: string, // only in quicklook
	}
}

window.assets_map = {}
window.assets_tag = {}
window.entry = []
window.entry_map = {}
window.max_view_data = {}
window.appWindow = getCurrentWebviewWindow()
window.emit = window.appWindow.emit.bind(window.appWindow)
window.listen = window.appWindow.listen.bind(window.appWindow)

export default function App() {
	const isSubwindow = WebviewWindow.getCurrent().label !== "main"
	return !isSubwindow ? <AppMain/> : <AppSub/>
}

function AppMain() {
	const articleRef = useRef<HTMLDivElement>(null)
	const { setScrollableWidget } = useContext(cacheContext)

	useEffect(()=> {
		setScrollableWidget({node: articleRef.current})
	}, [setScrollableWidget])

	const [theme] = useAppSetting("theme")
	const [systemTheme] = useAppSetting("systemTheme")
	const isDarkMode = (theme === "auto" ? systemTheme : theme) === "dark"
  return (
		<div className={isDarkMode ? "bp4-dark": undefined}>
			<header>
				<div onMouseDown={()=> WebviewWindow.getCurrent().startDragging()}>

				</div>
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
				</article>
			</div>
			<footer>
				<Footer/>
			</footer>
			{/* handlers */}
			<AppInit/>
			<AppMaxView/>
			<AppToaster top={40}/>
			<AppQuickSettings/>
			<AppFmodHandler/>
		</div>
	)
}

function AppSub() {
	return <SubRoutes/>
}