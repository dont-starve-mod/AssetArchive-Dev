import React, { useCallback, useEffect, useRef, useState } from 'react'
import style from './index.module.css'
import { WebviewWindow } from '@tauri-apps/api/window'
import { Button, Card, H5, H6, Icon, InputGroup, Spinner } from '@blueprintjs/core'
import { invoke } from '@tauri-apps/api'
import { useLuaCall, useLuaCallOnce } from '../../hooks'
import { update } from '../../redux/reducers/appsettings'

export default function FFmpegInstaller() {
  const [step, setStep] = useState<"intro"|"normal-install"|"custom-install">("intro")
  return (
    <div className={style["main"]}>
      <div className={style["box"]}>
        {
          step === "intro" ? <Intro setStep={setStep}/> :
          step === "normal-install" ?<Normal/> :
          step === "custom-install" ? <Custom setStep={setStep}/> :
          <></>
        }
      </div>
      <div style={{position: "absolute", left: 10, top: -2}}>
        {
          step !== "intro" &&
          <Button icon="arrow-left" small minimal onClick={()=> setStep("intro")}/>
        }
      </div>
    </div>
  )
}

function Intro({setStep}) {
  return (
    <>
      <H5>安装FFmpeg视频编码器</H5>
      <div style={{width: "100%", height: 0, backgroundColor: "#ccc", marginBottom: 10}}/>
      <div className={style["group"]}>
        <Card interactive onClick={()=> setStep("normal-install")}>
          <H6>一键安装（推荐）</H6>
          <div className='bp4-running-text'>
            <p>从公共源（www.gyan.dev）自动安装程序，需占用
              <strong>81MB</strong>空间，可随时卸载。</p>
          </div>
        </Card>
      </div>
      <div className={style["group"]}>
        <Card interactive onClick={()=> setStep("custom-install")}>
          <H6>自定义安装</H6>
          <div className='bp4-running-text'>
            <p>链接本地的FFmpeg程序包。</p>
          </div>
        </Card>
      </div>
    </>
  )
}

function Normal() {
  const [progress, setProgress] = useState<number|"start"|"finish">("start")

  useLuaCallOnce("ffmpeg_install", ()=> {}, {type: "start"}, [])

  const update = useLuaCall<string>("ffmpeg_install", response=> {
    const data = JSON.parse(response)
    if (data.success) {
      setProgress("finish")
    }
    else {
      const {current_downloaded, status} = data
      if (status === "WORKING" && current_downloaded > 10) {
        setProgress(current_downloaded / 1024 / 25886)
      }
    }
    console.log(data)
  }, {type: "update"}, [])

  useEffect(()=> {
    let timer = setInterval(update, 200)
    return ()=> clearInterval(timer)
  }, [update])

  // useEffect(()=> {
  //   setProgress("finish")
  // }, [])

  return (
    <>
      <H5>一键安装</H5>
      <div style={{marginTop: 100}}>
        {
          progress !== "finish" ?
          <Spinner intent="primary" value={typeof progress === "number" ? progress : undefined}/> :
          <Icon icon="tick-circle" intent="success" size={40}/>
        }
      </div>
      <div style={{marginTop: 10}}>
        {
          progress === "start" && <p>加载中，请稍候...</p>
        }
        {
          typeof progress === "number" && <p>正在下载（{Math.floor(progress*100)}%）</p>
        }
        {
          progress === "finish" && <p>安装成功</p>
        }
      </div>
    </>
  )
}

function Custom({setStep}) {
  const ref = useRef<HTMLInputElement>()
  const confirm = useCallback(()=> {
    const value = ref.current.value.trim()
    if (!value) {
      window.alert("请输入有效的路径")
    }
  }, [])
  const onKeyDown = useCallback((e: React.KeyboardEvent)=> {
    if (e.key === "Enter") {
      confirm()
    }
  }, [confirm])
  return (
    <>
      <H5>自定义安装</H5>
      <div style={{height: 10}}></div>
      <InputGroup
        inputRef={e=> {if (e) { ref.current = e; e.focus() }}}
        fill
        autoComplete="none"
        autoCorrect="none"
        spellCheck={false}
        maxLength={200}
        placeholder="输入FFmpeg路径"
        onKeyDown={onKeyDown}
        rightElement={
        <Button icon="small-tick" onClick={()=> confirm()}/>
      }/>
      <div className={style["hint"] + " bp4-running-text"}>
        <p>建议使用环境变量或绝对路径，例如：</p>
        <p className={style["path"]}>ffmpeg</p>
        <p className={style["path"]}>/usr/local/bin/ffmpeg</p>
        <p className={style["path"]}>/Users/Name/Downloads/ffmpeg</p>
        <p>FFmpeg必须包含libx264和png编码格式，以及mov、mp4和gif封装格式。</p>
        <p>如果你无法确认路径位置，请使用<a onClick={()=> setStep("intro")}>一键安装</a>。</p>
      </div>
    </>
  )
}

export function openInstaller() {
  let label = "ffmpeg-installer"
  let subwindow = WebviewWindow.getByLabel(label)
  if (subwindow)
    subwindow.setFocus()
  else
    new WebviewWindow(label, {
      title: "",
      url: "/ffmpeg-installer",
      width: 300,
      height: 400,
      resizable: false,
    })
}