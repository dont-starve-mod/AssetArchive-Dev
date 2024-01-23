import React, { SyntheticEvent, useCallback, useContext, useState } from 'react'
import { Button, ButtonGroup, ButtonProps, Collapse, Dialog, DialogBody, Icon, IconName, InputGroup, Radio, RadioGroup } from '@blueprintjs/core'
import style from './index.module.css'
import ApiPicker from '../ApiPicker'
import ApiOperator from '../ApiOperator'
import ApiList from '../ApiList'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { appWindow } from '@tauri-apps/api/window'
import { save, open } from '@tauri-apps/api/dialog'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { useLuaCall } from '../../hooks'
import NumericInputGroup from '../NumericInputGroup'
import { v4 } from 'uuid'

interface ActionProps {
  icon: IconName,
  tooltip?: string,
  cb: (e: React.MouseEvent)=> void,
}

type ControlPanelProps = {
  title: string,
  actions?: Array<ActionProps | React.ReactNode>,
  children?: React.ReactNode,
}
export default function ControlPanel(props: ControlPanelProps) {
  const {title, actions} = props
  const [showTools, setShowTools] = useState(false)
  const [unfold, setUnfold] = useState(true)
  return (
    <div 
      className={style["main"]}
      onMouseEnter={()=> setShowTools(true)} 
      onMouseLeave={()=> setShowTools(false)}>
      <div className={style["header"]} onClick={()=> setUnfold(v=> !v)}>
        <Icon icon={unfold ? "chevron-down" : "chevron-right"}/> 
        <span>{title}</span>
        {
          unfold &&
          <ButtonGroup minimal style={{position: "absolute", right: 2, top: 0}}>
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
      <div style={{position: "relative"}}>
        <Collapse isOpen={unfold} keepChildrenMounted={true}>
          <div className={style["content"]}>
            {
              props.children
            }
          </div>
        </Collapse>
      </div>
    </div>
  )
}

function ApiPanel() {
  const [open, setOpen] = useState(false)
  const onPopoverInteraction = useCallback((_, event: SyntheticEvent<HTMLElement, Event>)=> {
    const {type} = event
    if (type === "mousedown") {
      // console.log("MOUSE DOWN")
      setOpen(false)
    }
    else if (type === "click") {
      // console.log("CLICK")
      setOpen(v=> !v)
    }
  }, [])
  return (
    <ControlPanel 
      title="指令面板"
      actions={[
        {icon: "translate", cb: console.log},
        <div onClick={e=> e.stopPropagation()}>
          <Popover2 minimal placement="right-start" content={
            <ApiPicker style={{display: open ? undefined : "none"}}/>
          } 
            // keep popover always mounted
            isOpen onInteraction={onPopoverInteraction}
            autoFocus={false} enforceFocus={false}>
            <SmallButton icon="plus"/>
          </Popover2>
        </div>,
        // <div onClick={e=> e.stopPropagation()}>
        //   <Popover2 minimal position="right" content={<ApiOperator/>}>
        //     <SmallButton icon="minus"/>
        //   </Popover2>
        // </div>
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
  const [bgcType, setBgcType] = useState<"use_current"|"transparent"|"solid">("solid")
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

  const [resolution, setResolution] = useState(1)
  const [rate, setRate] = useState(30)

  const call = useLuaCall("render_animation_sync", ()=> {}, {}, [])
  const requestExportTo = useCallback((path: string)=> {
    animstate.pause()
    if (!animstate.hasFrameList) return
    const session_id = v4()
    appWindow.emit("set_session_id", session_id)
    call({
      session_id,
      path,
      api_list: animstate.getValidApiList(),
      render_param: {
        ...render.serialize(),
        scale: resolution,
        rate,
        format: fileExtension,
        facing: animstate.getActualFacing(),
        bgc: bgcType === "use_current" ?
          (render.bgcType === "transparent" ? "transparent" : render.bgc) :
          bgcType === "transparent" ? "transparent" : colorValue,
      }  
    })
  }, [fileExtension, resolution, rate, bgcType, colorValue, call])

  const onClickExport = useCallback(()=> {
    if (fileExtension === "png") {
      // batch export to folder
      open({
        title: "",
        directory: true,
      }).then(
        path=> typeof path === "string" && requestExportTo(path)
      )
    }
    else {
      // export as a single file
      save({
        title: "",
        defaultPath:  "export." + fileExtension, // TODO: formater
      }).then(
        path=> typeof path === "string" && requestExportTo(path)
      )
    }
  }, [fileExtension, requestExportTo])

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
          <Tooltip2 content={"支持透明背景，适合用作二创素材，较大的文件体积"} placement="right">
            <Radio 
              label="无损视频（mov）" 
              checked={fileExtension === "mov"}
              onChange={e=> handleExtensionCheck(e, "mov")}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"支持透明背景，便于逐帧修改，较大的文件体积"} placement="right">
            <Radio 
              label="无损图片序列（png）" 
              checked={fileExtension === "png"}
              onChange={e=> handleExtensionCheck(e, "png")}/>
          </Tooltip2>
        </div>
      </RadioGroup>
      <br/>
      <p>
        <strong>背景颜色</strong>
        {/* <Tooltip2 content={"使用当前背景色"} placement="right">
          <Button small icon="drawer-right-filled" style={{marginLeft: 10}} onClick={takeCurrentBgc}/>
        </Tooltip2> */}
      </p>
      <RadioGroup selectedValue={bgcType} onChange={e=> setBgcType(e.currentTarget.value as typeof bgcType)}>
        <Radio labelElement={
          <>
            <span>和当前场景一致</span>
            <Icon icon="arrow-right" style={{marginLeft: 4, color: "#666"}}/>
          </>
        } value={"use_current"}/>
        <Radio labelElement={
          <>
            <span>透明</span>
            {
              (fileExtension === "mp4" || fileExtension === "gif") && bgcType === "transparent" &&
              <Tooltip2 content={
                fileExtension === "mp4" ? 
                <span>当前格式（mp4）不支持透明，背景色将被填充为纯黑。<br/>如需导出透明背景视频，请使用无损视频（mov）格式。</span> :
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
      <br/>
      <Tooltip2 content={"该选项仅在mp4或gif格式下生效。"}>
        <p><strong>分辨率</strong>&nbsp;
            <Icon icon="small-info-sign"/>
        </p>
      </Tooltip2>
      <RadioGroup 
        selectedValue={resolution}
        onChange={e=> setResolution(Number(e.currentTarget.value))}
        disabled={fileExtension !== "gif" && fileExtension !== "mp4"}>
        <Radio label="原图" value={1} style={{display: "inline-block"}}/>
        <Radio label="1/2" value={0.5} style={{display: "inline-block", marginLeft: 20}}/>
      </RadioGroup>
      <br/>
      <p>
        <strong>帧率</strong>
        <div style={{width: 100, marginTop: 5, paddingRight: 30, position: "relative"}}>
          <NumericInputGroup min={1} max={100}
            numericValue={rate}
            disabled={fileExtension === "png"}
            small
            intent={rate === rate ? "none" : "danger"}
            onChangeNumericValue={setRate}/>
            {
              rate !== rate && fileExtension !== "png" &&
              <div style={{position: "absolute", right: -3, top: -3}}>
                <Tooltip2 content={"输入1–100之间的数，建议30"}>
                  <Button icon="warning-sign" minimal intent="danger" onClick={()=> setRate(30)}/>
                </Tooltip2>
              </div>
                
            }
        </div>
      </p>

      {/* <p><strong>文件路径</strong></p>
      <InputGroup
        spellCheck={false}
        autoComplete="none"
        multiple
        value={filepath}
        onChange={e=> setPath(e.currentTarget.value)}
        rightElement={<Button onClick={()=> selectExportFilepath()}>选择</Button>}
      /> */}

      </div>
      <div style={{margin: "5px 0", padding: "5px 0", borderTop: "1px solid #ccc"}}>
        <Button icon="export" intent="primary" fill disabled={!animstate.hasFrameList}
          onClick={()=> onClickExport()}>
          导出
        </Button>
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