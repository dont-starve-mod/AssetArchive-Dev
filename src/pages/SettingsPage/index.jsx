import React, { useEffect, useState } from 'react'
import { H4, Icon } from '@blueprintjs/core'
import { RadioGroup, Radio, Button, Slider } from '@blueprintjs/core'
import { useConfig } from '../../hooks'
import { appWindow } from '@tauri-apps/api/window'
import { Tooltip2 } from '@blueprintjs/popover2'

export default function Settings() {
  // TODO: useeffect有延迟，你懂的
  const [theme, setTheme] = useState()
  const [getThemeConfig, setThemeConfig] = useConfig("colortheme",
    v=> setTheme(v),
    v=> {
      setTheme(v)
      appWindow.emit("colortheme", v)
    })
  
  const [volume, setVolume] = useState(100)
  const [getVolumeConfig, setVolumeConfig] = useConfig("volume", 
    setVolume,
    setVolume)
  
  const [resolution, setResolution] = useState()
  const [getResolutionConfig, setResolutionConfig] = useConfig("resolution",
    setResolution,
    setResolution)

  useEffect(()=> {
    getThemeConfig()
    getVolumeConfig()
    getResolutionConfig()
  }, [])

  return <div className='no-select'>
    <H4>游戏目录</H4>
    <span className='bp4-monospace-text'>path/to/game</span>
    <span style={{display: "inline-block", width: 15}}/>
    <Button text="查看"/>
    &nbsp;&nbsp;
    <Button text="修改" intent="primary" rightIcon="edit" />

    <hr/>
    <H4>界面</H4>
    <RadioGroup
      label="颜色主题"
      onChange={e=> setThemeConfig({value: e.target.value})}
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
      selectedValue={"1000"}
      inline={true}
    >
      <Radio label="500" value="500"/>
      <Radio label="1000" value="1000"/>
      <Radio label={<Tooltip2 content={"展示太多搜索结果会导致卡顿，请谨慎开启"} placement="right">
        <>无上限 <Icon icon="small-info-sign"/></></Tooltip2>} value="inf"/>
    </RadioGroup>
    <hr/>
    <H4>画质</H4>
    <RadioGroup
      label="预览图片和动画的分辨率（只影响预览，不影响导出文件的清晰度）"
      onChange={e=> setResolutionConfig({value: e.target.value})}
      selectedValue={resolution}
      inline={true}
    >
      <Radio label="高清" value="full" />
      <Radio label={<Tooltip2 content={"画质较差，但加载速度更快"} placement="right">
        <>性能 <Icon icon="small-info-sign"/></></Tooltip2>} value="half"/>
    </RadioGroup>
    <hr/>
    <H4>音量</H4>
    <div style={{width: 200}}>

    <Slider min={0} max={100} labelStepSize={20} value={volume*1.0}
      intent="primary"
      onChange={setVolume}
      onRelease={value=> setVolumeConfig({value})}/>
      </div>
    {/* 索引文件管理 */}

    
  </div>
}
