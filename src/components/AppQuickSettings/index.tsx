import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { appWindow } from '@tauri-apps/api/window'
import { Button, Dialog, DialogBody, DialogFooter, H3, H5, H6, Radio, RadioGroup } from '@blueprintjs/core'
import { Event } from '@tauri-apps/api/event'
import AnimQuickLook from '../AnimQuickLook'
import { useQuickLookPresets, useQuickLookExport } from '../AnimQuickLook/util'
import { Tooltip2 } from '@blueprintjs/popover2'
import Preview from '../Preview'
import { useDispatch, useSelector } from '../../redux/store'
import { useLocalStorage } from '../../hooks'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { Preset } from '../AnimQuickLook/preset'

type QuickSettingsKey = "XmlMap.dot" | "AnimQuickLook"

export default function AppQuickSettings() {
  const [keys, setKeys] = useState<{[K in QuickSettingsKey]?: boolean}>({})
  const [data, setData] = useState<any>()
  // keys["AnimQuickLook"] = true
  useEffect(()=> {
    const unlisten = appWindow.listen("quick_settings", (e: Event<{key: QuickSettingsKey, data: any}>)=> {
      const {key, data} = e.payload
      setKeys(keys=> ({...keys, [key]: true}))
      setData(data)
    })
    return ()=> {unlisten.then(f=> f)}
  }, [])

  return (
    <>
      <Dialog title="小标签" isOpen={keys["XmlMap.dot"]} onClose={()=> setKeys({})} style={{width: 400}}>
        <DialogBody>
          <p>小标签代表这一图集包含的图片总数。</p>
          <p>不喜欢小标签？</p>
          <hr/>
          <RadioGroup>
            <Radio title=''>仅在图片数量大于1时显示</Radio>
            <Radio title=''>从不显示</Radio>
            <Radio title=''>总是显示</Radio>
          </RadioGroup>
        </DialogBody>
        {/* <DialogFooter actions={
          <>
            <Button>确认</Button>
          </>
        }/> */}
      </Dialog>
      <Dialog title="预览" isOpen={keys["AnimQuickLook"]} onClose={()=> setKeys({})} style={{width: 540, height: 380}}>
        <DialogBody>
          {/* <p style={{borderBottom: "0 solid #ccc"}}>当你预览武器、材质、动画的时候，想要如何穿搭？</p> */}
          <AnimQuickLookSettings data={data} closeDialog={()=> setKeys({})}/>
        </DialogBody>
      </Dialog>
    </>
  )
}

function AnimQuickLookSettings(props: {data: any, closeDialog: ()=> void}) {
  const {data, closeDialog} = props
  const presets = useQuickLookPresets(data)
  const animstate = useRef<AnimState>()
  const [_, forceUpdate] = useReducer(v=> v + 1, 0)

  const animstateRef = useCallback((anim: AnimState)=> {
    animstate.current = anim
    forceUpdate()
  }, [forceUpdate])
  const exportFn = useQuickLookExport(animstate.current)

  return (
    <div style={{display: "flex", width: "100%", alignItems: "center"}}>
      <div style={{width: 200, marginRight: 0, flexShrink: 0}}>
        <AnimQuickLook
          noCog
          animstateRef={animstateRef}
          bankhash={data.bank}
          build={data.build}
          animation={data.animation}
          facing={data.facing}
          width={200} minAspectRatio={1.0} maxAspectRatio={1.4}/>
      </div>
      <div style={{backgroundColor: "#0000", width: "100%", paddingLeft: 15}}>
        <div style={{maxHeight: 290, width: 290, paddingBottom: 40, overflowX: "hidden", overflowY: "auto"}}>
        <H5>预设</H5>
        {
          presets.map(v=> <PresetSelector key={v.key} groupKey={v.key} {...v}/>) 
        }
        <div style={{height: 10}}/>
        <H5>快速导出</H5>
        <Button icon="image-rotate-right" onClick={()=> exportFn("gif").then(()=> closeDialog())}>动图/gif</Button>
        <Button icon="video" onClick={()=> exportFn("mp4").then(()=> closeDialog())}>视频/mp4</Button>
        <Button icon="video" onClick={()=> exportFn("mov").then(()=> closeDialog())}>无损视频/mov</Button>
        <Button icon="widget" onClick={()=> exportFn("snapshot").then(()=> closeDialog())}>当前帧截图/png</Button>
        <p style={{marginTop: 10, color: "#aaa", cursor: "pointer"}} onClick={()=> window.alert("TODO:")}>
          在<b>「动画渲染器」</b>中可定制更多动画效果。
        </p>
        </div>
      </div>
    </div>
  )
}

type PresetSelectorProps = {
  groupKey: string,
  title: string,
  inline?: boolean,
  presets: Preset[],
}

function SimplePresetSelector(props: PresetSelectorProps) {
  const {presets, groupKey} = props
  const [selected, setSelected] = useLocalStorage("quicklook_presets")
  const selectedIndex = Math.max(presets.findIndex(v=> selected[`${groupKey}-${v.key}`]), 0)
  console.log(presets, selectedIndex)
  const onSelect = useCallback((key: string)=> {
    let data = {...selected}
    presets.forEach(v=> {
      if (key === v.key) {
        data[`${groupKey}-${v.key}`] = true
      }
      else {
        delete data[`${groupKey}-${v.key}`]
      }
    })
    console.log("PRESET", data)
    setSelected(data)
  }, [selected, presets, groupKey, setSelected])
  const simpleTitle = props.title === "#build" ? "外观" : 
    props.title === "#color" ? "调色" :
    props.title
  return (
    <>
      <H6 title={groupKey}>{simpleTitle}</H6>
      <div style={{marginBottom: 10}}>
        <RadioGroup 
          inline={props.inline}
          selectedValue={presets[selectedIndex].key} 
          onChange={e=> onSelect(e.currentTarget.value)}>
          {
            presets.map(({key, title})=> 
              <Radio style={{margin: "4px 5px"}} key={key} label={title || key} value={key}/>)
          }
        </RadioGroup>
      </div>
    </>
  )
}

function PresetSelector(props: PresetSelectorProps) {
  const {title, presets} = props
  // hook for simple
  if (title === "#build") return <SimplePresetSelector {...props}/>
  if (title === "#color") return <SimplePresetSelector {...props} inline/>
  return <SimplePresetSelector {...props}/>
  // TODO: 这个地方以后再优化
  return (
    <>
      <H6>{title}</H6>
      <div style={{display: "flex", flexWrap: "wrap", marginBottom: 10, width: "100%"}}>
        {
          presets.map(v=> <PresetIcon key={v.key} preset={v}/>)
        }
      </div>
    </>
  )
}

const SIZE = {width: 32, height: 32}
const getInventoryIconTex = (key: string, type: string) => {
  if (key.startsWith(type)){
    if (type === "equip_hand")
      return "equip_slot_hud.tex"
    else if (type === "equip_head")
      return "equip_slot_head_hud.tex"
    else if (type === "equip_body")
      return "equip_slot_body_hud.tex"
    else if (type === "saddle")
      return `${key}.tex`
  }
  else if (type === "equip_head"){
    return `${key}hat.tex`
  }
  else {
    return `${key}.tex`
  }
}

function PresetIcon(props: {preset: any}) {
  const {key, type, title, icon} = props.preset
  const invTex = getInventoryIconTex(key, type)
  const [stored_presets, setPresets] = useLocalStorage("quicklook_presets")
  const opacity = typeof invTex === "string" && invTex.startsWith("equip_slot") ? 0.2 : 1
  const selected = stored_presets[key]
  const backgroundColor = selected ? "var(--primary-color-5)" : undefined
  const border = selected ? "2px solid var(--primary-color-1)" : undefined

  const onClick = useCallback(()=> {
    const disables = {}
    // ALL_PRESETS.forEach((v)=> {
    //   if (type === v.type){
    //     disables[v.key] = false
    //   }
    // })
    setPresets({
      ...stored_presets,
      ...disables,
      [key]: true
    })
  }, [type, stored_presets, setPresets])

  return (
    <Tooltip2 placement='top' content={title || key}>
      <div style={{...SIZE, margin: 4, cursor: "pointer", borderRadius: 1, backgroundColor}} 
        className='bp4-elevation-1'>
        <div style={{opacity, position: "relative"}} onClick={onClick}>
        {
          type === "character_base" ?
          <Preview.SymbolElement {...SIZE} build={key} symbol={"swap_icon"} index={0}/> :
          (type === "equip_hand" || type === "equip_head" || type === "equip_body" ||
           type === "saddle") ?
          <Preview.AutoImage {...SIZE} xml="" xmlList={Preview.AutoImage.INVENTORYIMAGES}
            tex={invTex}/> :
          (type === "mount" || type === "pig_base") ?
          <Preview.AutoImage {...SIZE} xml="" xmlList={Preview.AutoImage.SCRAPBOOK}
            tex={`${icon || key}.tex`}/> :
            <></>
        }
          <div style={{position: "absolute", top: -2, left: -1, width: "calc(100% + 2px)", height: 4, border}}>

          </div>
        </div>
      </div>
    </Tooltip2>
  )
}