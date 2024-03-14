import { useContext, useEffect, useRef, useState } from 'react'
import { appWindow, getCurrent } from '@tauri-apps/api/window'
import { FocusStyleManager } from "@blueprintjs/core"
import "./App.css"
import Nav from './components/Nav'
import MainMenu from './components/MainMenu'
import Footer from './components/Footer'
import AppInit from './components/AppInit'
import AppToaster from './components/AppToaster'
import AppFmodHandler from './components/AppFmodHandler'
import AppQuickSettings from './components/AppQuickSettings'
import cacheContext from './components/KeepAlive/cacheContext'
import MainRoutes from './mainRoutes'
import SubRoutes from './subRoutes'
import { useAppSetting } from './hooks'
import type { ArchiveItem, Bank, Entry, Shader, StaticArchiveItem } from './searchengine'
import type { Xml, Tex, AnimDyn, AnimZip, TexNoRef, FmodEvent, FmodProject } from './searchengine'
import type { DefinedPresetGroup } from './components/AnimQuickLook/preset'
import { invoke } from '@tauri-apps/api'
FocusStyleManager.onlyShowFocusOnTabs()

// https://zhuanlan.zhihu.com/p/573735645 TODO:

declare global {
	interface Window {
		meta: {debug: boolean},
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
	}
}

window.assets_map = {}
window.assets_tag = {}
window.entry = []
window.entry_map = {}

export default function App() {
	const [metaLoaded, setMetaLoaded] = useState(false)
	useEffect(()=> {
		async function load() {
			// @ts-ignore
			window.meta = {}
			window.meta.debug = await invoke("get_is_debug")
		}
		load().then(()=> setMetaLoaded(true))
	}, [])

	const isSubwindow = getCurrent().label !== "main"
	return metaLoaded && (!isSubwindow ? <AppMain/> : <AppSub/>)
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
				<div onMouseDown={()=> appWindow.startDragging()}>

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
			<AppToaster top={40}/>
			<AppQuickSettings/>
			<AppFmodHandler/>
		</div>
	)
}

function AppSub() {
	return <SubRoutes/>
}