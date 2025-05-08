import { H3, H4 } from "@blueprintjs/core"
import { invoke } from "@tauri-apps/api/core"
import { homeDir } from '@tauri-apps/api/path'
import { open } from "@tauri-apps/plugin-dialog"
import { useCallback, useEffect, useState } from "react"

export default function QuickLookPage() {
  const [fileOver, setFileOver] = useState(false)
  const [recentList, setRecentList] = useState<string[]>([])
  const [home, setHome] = useState<string>("")
  const onClickBox = useCallback(async ()=> {
    let path_list = await open({multiple: true})
    // TODO: 这里需要警告 1: 非法后缀名 2: 文件过大 > 100MB 3: 文件类型错误 4: 数量过多
    invoke<string[]>("open_quicklook_windows", {path_list}).then(
      setRecentList
    )
  }, [])

  useEffect(()=> {
    homeDir().then(setHome)
  }, [])

  useEffect(()=> {
    const unlisten = window.appWindow.onDragDropEvent(({payload})=> {
      const {type} = payload
      if (type === "enter" || type === "over") {
        setFileOver(true)
      }
      else if (type === "leave" || type === "drop") {
        setFileOver(false)
        if (type === "drop") {
          invoke<string[]>("open_quicklook_windows", {path_list: payload.paths}).then(
            setRecentList
          )
        }
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    // only get recent list, no need to open quicklook
    invoke<string[]>("open_quicklook_windows", {path_list: []}).then(
      setRecentList
    )
  }, [])

  return (
    <div className="bp4-running-text">
      <H3 className="!mt-[10px]">快速预览 QuickLook</H3>
      <p>预览图片、动画、音乐等游戏资源文件内容。</p>
      <div className="w-40 h-28 mt-[20px] mb-[20px] border-slate-400 border-2 border-dotted rounded-[3px]
        flex justify-center items-center cursor-pointer select-none"
          onClick={onClickBox}>
        <div className="text-center">
          <p className="text-lg">打开文件</p>
          <p className="text-lg">或拖拽到这里</p>
        </div>
      </div>
      {
        recentList.length > 0 &&
        <H4>历史记录</H4>
      }
      {
        recentList.map(path=> <HistoryLink key={path} path={path} home={home}/>)
      }
      {
        // TODO: 清空历史记录
      }
      <div className={fileOver ? "absolute" : "hidden"}>
        <div className="fixed top-0 left-0 w-screen h-screen bg-purple-200/30">
        </div>
      </div>
    </div>
  )
}

function HistoryLink(props: {path: string, home: string}) {
  const {path, home} = props
  const displayedPath = path.startsWith(home) ? path.replace(home, "~") : path
  const onClick = useCallback(()=> {
    invoke("open_quicklook_windows", {path_list: [path]})
  }, [path])
  return (
    <p>
      <a className="py-[4px]" onClick={onClick}>{displayedPath}</a>
    </p>
  )

}
