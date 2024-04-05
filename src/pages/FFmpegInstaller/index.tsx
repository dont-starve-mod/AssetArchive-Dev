import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import style from './index.module.css'
import { WebviewWindow } from '@tauri-apps/api/window'
import { Button, Card, H5, H6, Icon, InputGroup, Spinner, Tag } from '@blueprintjs/core'
import { useLuaCall, useLuaCallOnce } from '../../hooks'
import { emit } from '@tauri-apps/api/event'

export default function FFmpegInstaller() {
  const [step, setStep] = useState<"intro"|"normal-install"|"custom-install">("intro")
  const [ffmpegState, setFState] = useState({installed: false, custom_installed: false, custom_path: ""})
  const [flag, forceUpdate] = useReducer(v=> v + 1, 0)
  useLuaCallOnce<string>("ffmpeg_getstate", response=> {
    setFState(JSON.parse(response))
  }, {}, [flag])

  useEffect(()=> {
    emit("ffmpeg_installed")
  }, [flag])

  return (
    <div className={style["main"]}>
      <div className={style["box"]}>
        {
          step === "intro" ? <Intro setStep={setStep} state={ffmpegState}/> :
          step === "normal-install" && ffmpegState.installed ? <Normal_Installed/> :
          step === "normal-install" && !ffmpegState.installed ? <Normal/> :
          step === "custom-install" ? <Custom setStep={setStep} state={ffmpegState} forceUpdate={forceUpdate}/> :
          <></>
        }
      </div>
      <div style={{position: "absolute", left: 10, top: -2}}>
        {
          step !== "intro" &&
          <Button icon="arrow-left" small minimal onClick={()=> [setStep("intro"), forceUpdate()]}/>
        }
      </div>
    </div>
  )
}

function Intro({setStep, state}) {
  return (
    <>
      <H5>安装FFmpeg视频编码器</H5>
      <div style={{width: "100%", height: 0, backgroundColor: "#ccc", marginBottom: 10}}/>
      <div className={style["group"]}>
        <Card interactive onClick={()=> setStep("normal-install")}>
          <H6>一键安装（推荐）
            {state.installed && <Tag style={{marginLeft: 5}} icon="tick-circle" intent="success">已安装</Tag>}
          </H6>
          <div className='bp4-running-text'>
            <p>从公共源（www.gyan.dev）自动安装程序，需占用
              <strong>81MB</strong>空间，可随时卸载。</p>
          </div>
        </Card>
      </div>
      <div className={style["group"]}>
        <Card interactive onClick={()=> setStep("custom-install")}>
          <H6>自定义安装
            {state.custom_installed && <Tag style={{marginLeft: 10}} icon="tick-circle" intent="success">已链接</Tag>}
          </H6>
          <div className='bp4-running-text'>
            <p>链接本地的FFmpeg程序包。</p>
          </div>
        </Card>
      </div>
    </>
  )
}

function Normal_Installed() {
  const uninstallCall = useLuaCall("ffmpeg_uninstall", ()=> {
    window.alert("卸载成功")
  }, {})
  return (
    <>
      <H5>一键安装</H5>
      <div style={{marginTop: 20}}>
        <p><strong>程序已安装成功。</strong></p>
        <div className={style["hint"] + " bp4-running-text"}>
          <p>如需卸载程序，请点击下方按钮。</p>
          <p>卸载后，将无法导出gif/mp4/mov格式的动画。</p>
          <div style={{margin: "0 auto", width: 80}}>
            <Button fill icon="cube-remove" onClick={()=> uninstallCall()}>卸载</Button>
          </div>
        </div>
      </div>
    </>
  )
}

function Normal() {
  const [progress, setProgress] = useState<number|"start"|"finish"|"error">("start")

  useLuaCallOnce("ffmpeg_install", ()=> {}, {type: "start"}, [])

  const update = useLuaCall<string>("ffmpeg_install", response=> {
    const data = JSON.parse(response)
    console.log(data)
    if (data.success) {
      setProgress("finish")
      emit("ffmpeg_installed")
    }
    else if (data.status && data.status.startsWith("ERROR")){
      setProgress("error")
    }
    else {
      const {current_downloaded, status} = data
      if (status === "WORKING" && current_downloaded > 10) {
        setProgress(current_downloaded / 1024 / 25886)
      }
    }
  }, {type: "update"}, [])

  useEffect(()=> {
    let timer = setInterval(update, 200)
    return ()=> clearInterval(timer)
  }, [update])

  return (
    <>
      <H5>一键安装</H5>
      <div style={{marginTop: 100}}>
        {
          progress === "finish" ? <Icon icon="tick-circle" intent="success" size={40}/> :
          progress === "error" ? <Icon icon="error" intent="danger" size={40}/> :
          <Spinner intent="primary" value={typeof progress === "number" ? progress : undefined}/>
        }
      </div>
      <div style={{marginTop: 10}}>
        {
          progress === "start" ? <p>加载中，请稍候...</p> :
          progress === "error" ? <p>下载失败，请检查网络连接。</p> :
          progress === "finish" ? <p>安装成功</p> :
          typeof progress === "number" ? <p>正在下载（{Math.floor(progress*100)}%）</p> :
          <></>
        }
      </div>
    </>
  )
}

function Custom({setStep, state, forceUpdate}) {
  const ref = useRef<HTMLInputElement>()
  const verify = useLuaCall<string>("ffmpeg_custom_install", response=> {
    const data = JSON.parse(response)
    if (data.success){
      window.alert("设置成功")
      forceUpdate()
    }
    else {
      window.alert("设置失败: \n"+data.message)
    }
  }, {}, [])

  const confirm = useCallback(()=> {
    const value = ref.current.value.trim()
    if (!value) {
      window.alert("请输入有效的路径")
    }
    else {
      verify({path: value})
    }
  }, [verify])
  const onKeyDown = useCallback((e: React.KeyboardEvent)=> {
    if (e.key === "Enter") {
      confirm()
    }
  }, [confirm])
  const resetCall = useLuaCall("ffmpeg_custom_install", ()=> {
    window.alert("已重置")
    forceUpdate()
    ref.current.value = ""
  }, {path: ""}, [])
  return (
    <>
      <H5>自定义安装</H5>
      <div style={{height: 10}}></div>
      <InputGroup
        inputRef={e=> {if (e) { ref.current = e; e.focus() }}}
        fill
        autoComplete="off"
        autoCorrect="none"
        spellCheck={false}
        maxLength={200}
        placeholder="输入FFmpeg路径"
        defaultValue={state && Boolean(state.custom_path) ? state.custom_path : undefined}
        onKeyDown={onKeyDown}
        rightElement={
        <Button icon="small-tick" onClick={()=> confirm()}/>
      }/>
      <div className={style["hint"] + " bp4-running-text"}>
        {
          !state.custom_installed ? <>
            <p>建议使用绝对路径，例如：</p>
            <p className={style["path"]}>C:/tools/ffmpeg.exe</p>
            <p className={style["path"]}>/opt/homebrew/bin/ffmpeg</p>
            {/* <p className={style["path"]}>/Users/Name/Downloads/ffmpeg</p> */}
            <p>FFmpeg必须包含libx264、gif和png编码格式，以及mp4、gif和mov封装格式。</p>
            <p>如果你无法确认路径位置，请使用<a onClick={()=> setStep("intro")}>一键安装</a>。</p>
          </> : <>
            <p>已成功链接本地的FFmpeg程序。</p>
            <p>如果路径发生变化，请修改上方输入框内容。</p>
            <p>如需重置，请点击按钮。</p>
            <div style={{width: 80, margin: "0 auto"}}>
              <Button fill icon="reset" onClick={()=> resetCall()}>重置</Button>
            </div>
          </>
        }
      </div>
    </>
  )
}

export function openInstaller() {
  let label = "ffmpeg-installer"
  let subwindow = WebviewWindow.getByLabel(label)
  if (subwindow)
    subwindow.setFocus().then(console.log, console.error)
  else
    new WebviewWindow(label, {
      title: "",
      url: "/ffmpeg-installer",
      width: 300,
      height: 400,
      resizable: false,
    })
}