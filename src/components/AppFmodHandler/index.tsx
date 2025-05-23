import React, { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from '../../redux/store'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useAppSetting } from '../../hooks'
import { setState } from '../../redux/reducers/appstates'
import { listen } from '@tauri-apps/api/event'
import { inv } from '../../pages/HomePage/clips'
const appWindow = getCurrentWebviewWindow()

export type FmodEventInfo = {
  id: string,
  name: string,
  group: string,
  path: string,
  category: string,
  hash: number,
  lengthms: number,
  param_list: {name: string, range: [number, number]}[],
  project: string,
}

export type FmodProjectInfo = {
  filename: string,
  fullpath: string,
  event_map: { [path: string]: FmodEventInfo }
}

export type FmodPlayingInfo = {
  playing: boolean,
  path: string,
  param_list: {name: string, range: [number, number], current: number}[],
}

export default function AppFmodHandler() {
  const [volume, _] = useAppSetting("volume")
  const root = useSelector(({appsettings})=> appsettings.last_dst_root)
  const dispatch = useDispatch()

  useEffect(()=> {
    invoke("fmod_send_message", {
      data: JSON.stringify({ api: "SetVolume", args: [volume/100], })
    }).then(
      ()=> {},
      console.error
    )
  }, [volume])

  useEffect(()=> {
    if (!root) return
    invoke<string>("fmod_send_message", {
      data: JSON.stringify({ api: "LoadGameAssets", args: [ root + "/sound" ] })
    }).then(
      ()=> {},
      console.error
    )
  }, [root])

  useEffect(()=> {
    let unlisten = listen<string>("fmod_audio_device", ({payload})=> {
      console.log("audio device:", payload)
      invoke<string>("fmod_reset", {
        data: JSON.stringify({ api: "LoadGameAssets", args: [ root + "/sound" ] })
      }).then(
        console.log,
        console.error
      )
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [root])

  /** string value from backend, convert it to json only on changed */
  const info_string = useRef<string>("")

  const onGetData = useCallback((response: string)=> {
    if (response.length === 0) return
    // console.log("GetFmodData", response.length)
    const data = JSON.parse(response)
    data.forEach(([key, value]:
      ["allfmodevent" | "allinfo", string]) => {
      if (key === "allfmodevent") {
        let project: {[K: string]: FmodProjectInfo} = JSON.parse(value)
        let allfmodevent = []
        let allfmodproject = []
        Object.entries(project).forEach(([name, v])=> {
          Object.entries(v.event_map).forEach(([_, data])=> {
            data.id = `f-${data.hash}`
            //@ts-ignore
            data.type = "fmodevent"
            allfmodevent.push(data)
          })
          allfmodproject.push({
            id: "fev-"+v.filename.replace(".fev", ""),
            name: name,
            type: "fmodproject",
            file: "sound/"+v.filename
          })
        })
        window.assets.allfmodevent = allfmodevent
        window.assets.allfmodproject = allfmodproject
        for (let list of [allfmodevent, allfmodproject]) {
          list.forEach(data=> {
            if (window.assets_map[data.id]){
              data = Object.assign(data, window.assets_map[data.id])
            }
            window.assets_map[data.id] = data
          })
        }
        // push data to searchengine
        appWindow.emit("update_assets", {allfmodevent, allfmodproject})
      }
      else if (key === "allinfo") {
        if (value !== info_string.current) {
          info_string.current = value
          dispatch(setState({
            key: "fmod_playing_info",
            value: JSON.parse(value)
          }))
        }
      }
    })
  }, [dispatch])

  const onGetDataError = useCallback((error: string)=> {
    appWindow.emit("fmod_call_error", error)
  }, [])

  useEffect(()=> {
    let token = -1
    let update = ()=> {
      invoke<string>("fmod_get_data", { only_dirty: true }).then(
        onGetData,
        onGetDataError,
      )
      token = requestAnimationFrame(update)
    }
    update()
    return ()=> cancelAnimationFrame(token)
  }, [onGetData, onGetDataError])

  return (
    <></>
  )
}