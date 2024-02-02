import React, { useCallback, useEffect, useState } from 'react'
import { appWindow } from '@tauri-apps/api/window'
import { Button, Dialog, DialogBody, DialogFooter, H5, H6, Radio, RadioGroup } from '@blueprintjs/core'
import { Event } from '@tauri-apps/api/event'
import AnimQuickLook from '../AnimQuickLook'
import { useQuickLookPresets, Preset, ALL_PRESETS } from '../AnimQuickLook/util'
import { Tooltip2 } from '@blueprintjs/popover2'
import Preview from '../Preview'
import { useDispatch, useSelector } from '../../redux/store'
import { useLocalStorage } from '../../hooks'

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
      <Dialog title="预览配置" isOpen={keys["AnimQuickLook"]} onClose={()=> setKeys({})} style={{width: 540, height: 380}}>
        <DialogBody>
          <p style={{borderBottom: "0 solid #ccc"}}>当你预览武器、材质、动画的时候，想要如何穿搭？</p>
          <AnimQuickLookSettings data={data}/>
        </DialogBody>
      </Dialog>
    </>
  )
}

function AnimQuickLookSettings(props: {data: any}) {
  const {data} = props
  const presets = useQuickLookPresets(data)
  return (
    <div style={{display: "flex", width: "100%", alignItems: "center"}}>
      <div style={{width: 200, marginRight: 0, flexShrink: 0}}>
        <AnimQuickLook
          noCog
          bankhash={data.bank}
          build={data.build}
          animation={data.animation}
          facing={data.facing}
          width={200} minAspectRatio={1.0} maxAspectRatio={1.4}/>
      </div>
      <div style={{backgroundColor: "#0000", width: "100%", paddingLeft: 10}}>
        <div style={{maxHeight: 290, width: 290, paddingBottom: 40, overflowX: "hidden", overflowY: "auto"}}>
        {
          presets.map(v=> 
          v.activated && <PresetSelector 
            key={v.type}
            type={v.type as any} 
            title={v.title} 
            presets={v.presets}/>
          )
        }
        </div>
      </div>
    </div>
  )
}

type PresetSelectorProps = {
  title: string,
  type: Preset["type"],
  presets: Preset[],
}

function PresetSelector(props: PresetSelectorProps) {
  const {title, type, presets} = props
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
function PresetIcon(props: {preset: Preset}) {
  const {key, type, title, icon} = props.preset
  const invTex = getInventoryIconTex(key, type)
  const [stored_presets, setPresets] = useLocalStorage("quicklook_presets")
  const opacity = typeof invTex === "string" && invTex.startsWith("equip_slot") ? 0.2 : 1
  const selected = stored_presets[key]
  const backgroundColor = selected ? "var(--primary-color-5)" : undefined
  const border = selected ? "2px solid var(--primary-color-1)" : undefined

  const onClick = useCallback(()=> {
    const disables = {}
    ALL_PRESETS.forEach((v)=> {
      if (type === v.type){
        disables[v.key] = false
      }
    })
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