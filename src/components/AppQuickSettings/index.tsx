import React, { useEffect, useState } from 'react'
import { appWindow } from '@tauri-apps/api/window'
import { Button, Dialog, DialogBody, DialogFooter, Radio, RadioGroup } from '@blueprintjs/core'
import { Event } from '@tauri-apps/api/event'

type QuickSettingsKey = "XmlMap.dot"
export default function AppQuickSettings() {
  const [keys, setKeys] = useState({})
  useEffect(()=> {
    const unlisten = appWindow.listen("quick_settings", (e: Event<QuickSettingsKey>)=> {
      setKeys(k=> ({...k, [e.payload]: true}))
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
    </>
  )
}
