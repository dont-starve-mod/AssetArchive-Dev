import React, { useCallback, useState } from 'react'
import { Button } from '@blueprintjs/core'
import { useLuaCall } from '../../hooks'
import { open } from '@tauri-apps/api/dialog'
import { appWindow } from '@tauri-apps/api/window'

type BatchDownloadButtonProps = {
  text?: string,
  type: "xml" | "build" | "fev_ref",
  [K: string]: any,
}

export default function BatchDownloadButton(props: BatchDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const {text = "批量导出"} = props

  const call = useLuaCall<string>("batch_download", result=> {
    setLoading(false)
    const data: { success: boolean, output_dir_path: string} = JSON.parse(result)
    if (data.success){
      appWindow.emit("toast", {
        message: "导出成功",
        icon: "saved", 
        intent: "success",
        savepath: data.output_dir_path 
      })
    }
  }, {}, [])
  const fn = useCallback(async ()=> {
    const dirpath = await open({
      directory: true,
      multiple: false,
      title: ""
    })
    if (typeof dirpath === "string"){
      setLoading(true)
      call({...props, target_dir: dirpath})
    }
  }, [call])

  return (
    <Button loading={loading} icon="download" onClick={()=> fn()}>
      {text}
    </Button>
  )
}
