import React, { useEffect, useState } from 'react'
import { Dialog, DialogBody, DialogFooter, H4, Icon } from '@blueprintjs/core'
import { RadioGroup, Radio, Button, Slider } from '@blueprintjs/core'
import { useAppSetting, useLuaCall } from '../../hooks'
import { Tooltip2 } from '@blueprintjs/popover2'
import { DragFolderPanel } from '../../components/GameRootSetter'
import { invoke } from '@tauri-apps/api'
import { appWindow } from '@tauri-apps/api/window'

export default function SettingsPage() {
  const [root, setRoot] = useAppSetting("last_dst_root")
  const [isEditingRoot, setEditingRoot] = useState(false)
  const [theme, setTheme] = useAppSetting("theme")
  const [volume, setVolume] = useAppSetting("volume")
  const [resolution, setResolution] = useAppSetting("resolution")
  const [numResults, setNumResults] = useAppSetting("num_search_results")

  const showRoot = useLuaCall("showroot", ()=> {})
  
  return <div className='no-select'>
    <H4>游戏目录</H4>
    <div 
      className='bp4-monospace-text'
      style={{userSelect: "auto", WebkitUserSelect: "auto", margin: "10px 0", cursor: "text"}}>
      {root}
    </div>
    <Button text="打开文件夹" onClick={()=> root !== null && showRoot()}/>
    &nbsp;&nbsp;
    <Button text="修改" intent="primary" rightIcon="edit" onClick={()=> setEditingRoot(true)}/>

    <hr/>
    <H4>界面</H4>
    <RadioGroup
      label="颜色主题"
      onChange={(e)=> setTheme(e.currentTarget.value as typeof theme)}
      selectedValue={theme}
      inline={true}
    >
      <Radio label="跟随系统" value="auto" />
      <Radio label="浅色" value="light" />
      <Radio label="深色" value="dark" />
    </RadioGroup>
    <hr/>
    <H4>搜索</H4>
    <RadioGroup
      label="搜索结果的最大显示数量"
      onChange={e=> setNumResults(Number(e.currentTarget.value))}
      selectedValue={numResults}
      inline={true}
    >
      <Radio label="100" value={100}/>
      <Radio label='500' value={500}/>
      <Radio label="1000" value={1000}/>
      <Radio labelElement={<Tooltip2 content={"展示太多搜索结果会导致卡顿，请谨慎开启"} placement="right">
        <>无上限 <Icon icon="small-info-sign"/></></Tooltip2>} value={-1}/>
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