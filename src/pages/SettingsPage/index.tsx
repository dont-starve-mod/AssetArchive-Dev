import React, { useEffect, useReducer, useState } from 'react'
import { Callout, Dialog, DialogBody, DialogFooter, H4, Icon, Tag } from '@blueprintjs/core'
import { RadioGroup, Radio, Button, Slider } from '@blueprintjs/core'
import { useAppSetting, useLocalStorage, useLuaCall, useLuaCallOnce } from '../../hooks'
import { Tooltip2 } from '@blueprintjs/popover2'
import { DragFolderPanel } from '../../components/GameRootSetter'
import { invoke } from '@tauri-apps/api'
import { appWindow } from '@tauri-apps/api/window'
import { openInstaller } from '../FFmpegInstaller'
import { listen } from '@tauri-apps/api/event'
import { useNavigate } from 'react-router-dom'
import { getGameTypeByRoot } from '../../components/AppFirstLaunch'

type FFmpeg = {
  checking: boolean,
  installed: boolean,
  custom_installed: boolean,
  custom_path: string,
}

export default function SettingsPage() {
  const [root, _] = useAppSetting("last_dst_root")
  const [isEditingRoot, setEditingRoot] = useState(false)
  const [theme, setTheme] = useAppSetting("theme")
  const [volume, setVolume] = useAppSetting("volume")
  const [resolution, setResolution] = useAppSetting("resolution")
  const [numResults, setNumResults] = useLocalStorage("num_search_results_per_page")
  const [showDesc, setShowDesc] = useAppSetting("quick_search_desc")
  const [numToast, setNumToast] = useLocalStorage("toast_max_num")
  const [aliveTime, setAliveTime] = useLocalStorage("toast_alive_time")
  const [ffmpegState, setFState] = useState<FFmpeg>({
    checking: true,
    installed: false,
    custom_installed: false,
    custom_path: ""
  })
  const installed = ffmpegState.installed || ffmpegState.custom_installed

  const showRoot = useLuaCall("showroot", ()=> {})
  const [flag, updateFromInstaller] = useReducer(v=> v + 1, 0)
  useEffect(()=> {
    let unlisten = listen("ffmpeg_installed", ()=> {
      updateFromInstaller()
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [updateFromInstaller])

  useLuaCallOnce<string>("ffmpeg_getstate", response=> {
    setFState({
      checking: false,
      ...JSON.parse(response)
    })
  }, {}, [flag])

  const guessedGameType = root && getGameTypeByRoot(root)

  const navigate = useNavigate()
  
  return <div className='no-select'>
    <H4>游戏目录</H4>
    {
      !root && <Callout intent="warning">
        <p>尚未设置饥荒游戏目录，现在去设置？
          <Button small intent="primary" icon="cog" onClick={()=> navigate("/welcome")}/>
        </p>
      </Callout>
    }
    <div 
      className='bp4-monospace-text'
      style={{userSelect: "auto", WebkitUserSelect: "auto", margin: "10px 0", cursor: "text"}}>
      {root}
    </div>
    {
      root && <>
        {
          guessedGameType === "ds" && <Callout className="mb-3" intent="warning">
            <p>本软件尚未支持单机版DLC资源加载，请等待后续更新。</p>
          </Callout>
        }
        <Button text="打开文件夹" onClick={()=> root !== null && showRoot()} style={{marginRight: 10}}/>
        <Button text="修改" intent="primary" rightIcon="edit" onClick={()=> setEditingRoot(true)}/>
      </>
    }
    <hr/>
    <H4>界面</H4>
    <RadioGroup
      label="颜色主题"
      onChange={(e)=> setTheme(e.currentTarget.value as typeof theme)}
      selectedValue={theme}
      inline={true}
    >
      <Radio label="浅色" value="light" />
      <Radio label="深色" value="dark" />
      <Radio label="跟随系统" value="auto" />
    </RadioGroup>
    <hr/>
    <H4>搜索</H4>
    {/* <RadioGroup
      label="搜索提示中是否显示简介"
      onChange={(e)=> setShowDesc(e.currentTarget.value as typeof showDesc)}
      selectedValue={showDesc}
      inline={true}
    >
      <Radio label='是' value={"on"}/>
      <Radio label='否' value={"off"}/>
    </RadioGroup>
    <br/> */}
    <RadioGroup
      label="每页展示搜索结果的数量"
      onChange={e=> setNumResults(Number(e.currentTarget.value))}
      selectedValue={numResults}
      inline={true}
    >
      <Radio label='50' value={50}/>
      <Radio label="100" value={100}/>
      <Radio label="200" value={1000}/>
      <Radio labelElement={<Tooltip2 content={"展示太多搜索结果会导致卡顿，请谨慎开启"} placement="right">
        <>500 <Icon icon="small-info-sign"/></></Tooltip2>} value={500}/>
    </RadioGroup>
    <hr/>
    <H4>画质</H4>
    <RadioGroup
      label="预览图片和动画的分辨率（只影响预览，不影响导出文件的清晰度）"
      onChange={e=> setResolution(e.currentTarget.value as typeof resolution)}
      selectedValue={resolution}
      inline={true}
    >
      <Radio label="高清" value="full" />
      <Radio labelElement={<Tooltip2 content={"画质较差，但加载速度更快"} placement="right">
        <>性能 <Icon icon="small-info-sign"/></></Tooltip2>} value="half"/>
    </RadioGroup>
    <hr/>
    <H4>音量</H4>
    <div style={{width: 200}}>

    <Slider min={0} max={100} labelStepSize={20} value={volume*1.0}
      intent="primary"
      onChange={setVolume}
      onRelease={value=> setVolume(value)}/>
      </div>
    {/* 索引文件管理 */}
    <hr/>
    <H4>快捷消息</H4>
    <p>设置右上角弹出信息的显示方式。
      <Button icon="rocket-slant" onClick={
        ()=> appWindow.emit("toast", {
          message: "测试信息",
          icon: "emoji", 
          intent: "success",
        })}>测试</Button>
    </p>
    <RadioGroup
      label="最大数量"
      inline
      selectedValue={numToast}
      onChange={e=> setNumToast(Number(e.currentTarget.value))}
    >
      <Radio label="1" value={1}/>
      <Radio label="5" value={5}/>
      <Radio label="10" value={10}/>
    </RadioGroup>
    <RadioGroup
      label="消失速度"
      inline
      selectedValue={aliveTime}
      onChange={(e)=> setAliveTime(Number(e.currentTarget.value))}
    >
      <Radio label="默认" value={7}/>
      <Radio label="更快" value={3}/>
      <Radio label="更慢" value={15}/>
      <Radio label="不消失" value={1e10}/>
    </RadioGroup>
    <hr/>
    <H4>视频编码器
      <Tag 
        className="ml-1"
        intent={ffmpegState.checking ? "none" : installed ? "success" : "warning"}>
        {
          ffmpegState.checking ? "检查中..." : installed ? "已安装" : "未安装"
        }
      </Tag>
    </H4>
    <p>FFmpeg是一个开源的多媒体编解码程序，饥荒资源档案的部分功能（例如动画导出）需要依赖FFmpeg。</p>
    <Button icon="download" onClick={()=> openInstaller()}>
      {
        (ffmpegState.checking || installed) ? "配置" : "安装"
      }
    </Button>
    <div style={{height: 100}}></div>

    <Dialog title="设置游戏目录" isOpen={isEditingRoot} onClose={()=> setEditingRoot(false)}>
      <DialogBody>
        <DragFolderPanel/>
      </DialogBody>
      <DialogFooter actions={
        <Button intent="primary" onClick={()=> {appWindow.emit("submit_root"); setEditingRoot(false)}}>确认</Button>
      }/>
    </Dialog>
  </div>
}