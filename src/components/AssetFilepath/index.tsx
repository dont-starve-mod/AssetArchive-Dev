import React, { useCallback, useState, useMemo } from 'react'
import { writeText } from '../../clipboard'
import { Button, Dialog, DialogBody, Menu, MenuItem } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { useCopySuccess, useLuaCall } from '../../hooks'
import { useNavigate } from 'react-router-dom'

type AssetFilePathProps = {
  type: "xml" | "tex" | "xml_link" | "fev_link" | "fev" | "fsb" | "source",
  path?: string,
  name?: string,
}

export default function AssetFilePath(props: AssetFilePathProps) {
  let {type, path} = props
  const success = useCopySuccess("path")
  const navigate = useNavigate()
  const [bundleInfo, setBundleInfo] = useState<{zippath: string}>()

  const fevData = useMemo(()=> {
    if (type === "fev" || type === "fev_link") {
      let project = window.assets.allfmodproject.find(v=> v.name === path)
      return project
    }
  }, [type, path])

  if (type.startsWith("fev")) {
    path = fevData ? fevData.file : "/"
  }

  const xmlLink = useMemo(()=> {
    if (type === "xml_link") {
      const asset = window.assets.allxmlfile.find(item=> item.type === "xml" && item.file === path)
      return asset && asset.id && "/asset?id=" + asset.id
    }
  }, [path, type])

  const fevLink = useMemo(()=> {
    return type === "fev_link" && fevData && fevData.id && "/asset?id=" + fevData.id
  }, [fevData, type])

  const directURL = xmlLink || fevLink
  const [open, setOpen] = useState(false)
  const onInteraction = useCallback((open: boolean)=> {
    if (open && directURL && window.keystate["ctrl"])
      navigate(directURL)
    else
      setOpen(open)
  }, [setOpen, directURL, navigate])

  const call = useLuaCall<string>("load", (result)=> {
    const data: any = JSON.parse(result)
    if (typeof data === "object" && data.is_databundle){
      setBundleInfo({zippath: data.path})
    }
  }, {type: "show", file: path})

  const requestOpeningFolder = useCallback((select_databundle: boolean)=> {
    call({select_databundle})
  }, [call])

  return (
    <div>
      <p>
        {
          (type === "xml" || type === "xml_link") ? "xml文件路径：" :
          type === "tex" ? "tex文件路径：" :
          type === "fev_link" ? "fev文件路径：" :
          type === "fev" ? "文件路径：" :
          ""
        }
        <Popover2 
          minimal 
          placement="top" 
          isOpen={open}
          onInteraction={onInteraction}
          content={<Menu>
          <MenuItem text="拷贝路径" icon="duplicate" onClick={()=> writeText(path).then(()=> success())}/>
          {
            type !== "source" && <MenuItem text="打开文件位置" icon="folder-open" onClick={()=> requestOpeningFolder(false)}/>
          }
          {
            type === "xml_link" && <MenuItem text="跳转到图集" icon="link" onClick={()=> navigate(directURL)}/>
          }
          {
            type === "fev_link" && Boolean(fevData) && <MenuItem text="跳转到音效包" icon="link" onClick={()=> navigate(directURL)}/>
          }
        </Menu>}>
          <a 
            className={"bp4-monospace-text"} 
            style={{userSelect: "all", WebkitUserSelect: "all", cursor: "pointer"}}>
            { path }
          </a>
        </Popover2>
        {/* <Button icon="more" minimal small style={{marginLeft: 5}}/> */}
      </p>
      <Dialog
        title="提示" 
        icon="info-sign"
        style={{maxWidth: 400}} 
        isOpen={Boolean(bundleInfo)} 
        onClose={()=> setBundleInfo(undefined)}>
          {
            bundleInfo &&
            <DialogBody className="bp4-running-text">
              <p>资源文件位于压缩包
                <a onClick={()=> requestOpeningFolder(true)}>{bundleInfo.zippath}</a>
                内。你可以先解压，然后在里面找到文件{path}。</p>
            </DialogBody>
          }
      </Dialog>
    </div>
  )
}
