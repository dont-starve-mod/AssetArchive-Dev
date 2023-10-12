import React, { Children, useCallback, useContext, useState } from 'react'
import { Button, ButtonGroup, ButtonProps, Callout, Card, Collapse, H5, H6, Icon, IconName, InputGroup, Radio, RadioGroup } from '@blueprintjs/core'
import style from './index.module.css'
import ApiPicker from '../ApiPicker'
import ApiList from '../ApiList'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { appWindow } from '@tauri-apps/api/window'
import { save } from '@tauri-apps/api/dialog'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { invoke } from '@tauri-apps/api'
import { useLuaCall } from '../../hooks'

interface ActionProps {
  icon: IconName,
  tooltip?: string,
  cb: (e: React.MouseEvent)=> void,
}

interface IProps {
  title: string,
  actions?: Array<ActionProps | React.ReactNode>,
  children?: React.ReactNode,
}
export default function ControlPanel(props: IProps) {
  const {title, actions} = props
  const [showTools, setShowTools] = useState(false)
  const [unfold, setUnfold] = useState(true)
  return (
    <div style={{"overscrollBehavior": "none"}} onMouseEnter={()=> setShowTools(true)} onMouseLeave={()=> setShowTools(false)}>
      <div className={style["header"]} onClick={()=> setUnfold(v=> !v)}>
        <Icon icon={unfold ? "chevron-down" : "chevron-right"}/> 
        <span>{title}</span>
        {
          unfold &&
          <ButtonGroup minimal style={{position: "absolute", right: 2, top: 2}}>
            {
              actions?.map((item, index)=> {
                if (React.isValidElement(item))
                  return <span key={index}>{item}</span>
                else {
                  const {icon, cb, tooltip} = item as ActionProps
                  return <SmallButton key={index}
                    icon={icon} 
                    onClick={(e: React.MouseEvent)=> { e.stopPropagation(); cb(e) }}
                  />
                }
              })
            }
          </ButtonGroup>
        }
      </div>
      <Collapse isOpen={unfold} keepChildrenMounted={true}>
        <div className={style["content"]}>
          {
            props.children
          }
        </div>
      </Collapse>
    </div>
  )
}

function ApiPanel() {
  return (
    <ControlPanel 
      title="指令面板"
      actions={[
        {icon: "translate", cb: console.log},
        <div onClick={e=> e.stopPropagation()}>
          <Popover2 minimal position='right' content={<ApiPicker />} >
            <SmallButton icon={"plus"}/>
          </Popover2>
        </div>
      ]}>
      <ApiList />
    </ControlPanel>
  )
}

function Export() {
  const [fileExtension, setFileExtension] = useState<"gif"|"mp4"|"mov"|"png">("gif")
  const handleExtensionCheck = useCallback((e: React.FormEvent<HTMLInputElement>, value: typeof fileExtension)=> {
    if (e.currentTarget.checked){
      setFileExtension(value)
    }
  }, [])
  const [bgcType, setBgcType] = useState<"transparent"|"solid">("solid")
  const [colorValue, setColorValue] = useState<string>("#c0c0c0")
  const onChangeColor = useCallback((e: React.ChangeEvent<HTMLInputElement>)=> {
    setBgcType("solid")
    setColorValue(e.currentTarget.value)
  }, [setBgcType, setColorValue])

  const {render, animstate} = useContext(animstateContext)
  const takeCurrentBgc = useCallback(()=> {
    setBgcType(render.bgcType)
    setColorValue(render.bgc)
  }, [render])

  const [filepath, setPath] = useState<string>("")
  const selectExportFilepath = useCallback((cb?: (path: string)=> void)=> {
    save({
      title: "",
      defaultPath:  "export.gif",
    }).then(
      path=> {
        if (typeof path === "string") {
          setPath(path)
          if (typeof cb === "function") cb(path)
        }
      }
    )
  }, [])

  const call = useLuaCall("render_animation_sync", ()=> {}, {}, [])

  const requestExport = useCallback((path?: string)=> {
    if (path || filepath){
      path = path || filepath
      console.log("Export to path: ", path)
      console.log(animstate.getApiList())
      call({
        path,
        api_list: animstate.getApiList(),
        render_param: {
          ...render.serialize(),
          fps: 30,
          facing: 8, // TODO: !!!!!!!!!
        },
      })
    }
    else{
      selectExportFilepath(requestExport)
    }
  }, [filepath])

  return (
    <ControlPanel
      title="导出"
      actions={[]}>
      <div style={{padding: 8}}>

      <p><strong>文件格式</strong></p>
      <RadioGroup selectedValue={""} onChange={()=> {}}>
        <div>
          <Tooltip2 content={"易于预览的格式"} placement="right">
            <Radio 
              label="动图（gif）" 
              checked={fileExtension === "gif"} 
              onChange={e=> handleExtensionCheck(e, "gif")}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"易于预览的格式，不支持透明背景，较小的文件体积"} placement="right">
            <Radio 
              label="视频（mp4）" 
              checked={fileExtension === "mp4"}
              onChange={e=> handleExtensionCheck(e, "mp4")}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"支持透明背景，适合用作视频素材，较大的文件体积"} placement="right">
            <Radio 
              label="无损视频（mov）" 
              checked={fileExtension === "mov"}
              onChange={e=> handleExtensionCheck(e, "mov")}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"支持透明背景，便于修改，较大的文件体积"} placement="right">
            <Radio 
              label="图片序列（png）" 
              checked={fileExtension === "png"}
              onChange={e=> handleExtensionCheck(e, "png")}/>
          </Tooltip2>
        </div>
      </RadioGroup>
      <br/>
      {/* <p><strong>帧率</strong></p>
      <InputGroup type="number" min={1} max={60} /> */}
      <p>
        <strong>背景颜色</strong>
        <Tooltip2 content={"使用当前背景色"} placement="right">
          <Button small icon="drawer-right-filled" style={{marginLeft: 10}} onClick={takeCurrentBgc}/>
        </Tooltip2>
      </p>
      <RadioGroup selectedValue={bgcType} onChange={e=> setBgcType(e.currentTarget.value as typeof bgcType)}>
        <Radio labelElement={
          <>
            <span>透明</span>
            {
              (fileExtension === "mp4" || fileExtension === "gif") && bgcType === "transparent" &&
              <Tooltip2 content={
                fileExtension === "mp4" ? 
                <span>当前格式（mp4）不支持透明，<br/>背景色将被填充为纯黑。</span> :
                fileExtension === "gif" ?
                <span>当前格式（gif）以透明背景导出时，<br/>图像边缘可能有锯齿，这是正常现象。</span> :
                <></>
              }>
                <Button icon="warning-sign" small minimal intent="danger" style={{marginLeft: 10}}/>
              </Tooltip2>
            }
          </>
        } value={"transparent"}/>
        <Radio label="纯色" value={"solid"} inline style={{display: "inline-block"}}/>
        <input type="color" style={{display: "inline-block", marginLeft: 10}} value={colorValue} onChange={onChangeColor}/>
      </RadioGroup>
      {/* {
        (fileExtension === "mp4" || fileExtension === "gif") && bgcType === "transparent" &&
        <div style={{margin: "10px 0", padding: 5, color: "#ff0000", backgroundColor: "#fee", border: "1px solid #f00", borderRadius: 2}}>
          {
            fileExtension === "mp4" &&
            <span>当前格式（mp4）不支持透明，背景色将被填充为纯黑。</span>
          }
          {
            fileExtension === "gif" &&
            <span>当前格式（gif）以透明背景导出时，图像边缘可能有锯齿，这是正常现象。</span>
          }
        </div>
      } */}
      <br/>
      <br/>
      <p><strong>文件路径</strong></p>
      <InputGroup
        spellCheck={false}
        autoComplete="none"
        multiple
        value={filepath}
        onChange={e=> setPath(e.currentTarget.value)}
        rightElement={<Button onClick={()=> selectExportFilepath()}>选择</Button>}
      />

      </div>
      <div style={{margin: "5px 0", padding: "5px 0", borderTop: "1px solid #ccc"}}>
        <Button icon="export" intent="primary" fill onClick={()=> requestExport()}>导出</Button>
      </div>
      <div style={{height: 40}}></div>
    </ControlPanel>
  )

}

ControlPanel.ApiPanel = ApiPanel
ControlPanel.Export = Export

// utils
function SmallButton(props: ButtonProps) {
  return <Button {...props} small/>
}