import React, { Children, useState } from 'react'
import { Button, ButtonGroup, ButtonProps, Callout, Card, Collapse, H5, H6, Icon, IconName, InputGroup, Radio, RadioGroup } from '@blueprintjs/core'
import style from './index.module.css'
import ApiPicker from '../ApiPicker'
import ApiList from '../ApiList'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'

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

function Skeleton() {

}

function Swap() {

}

function ColourPalette() {

}

function Export() {
  const [fileExtension, setFileExtension] = useState<"gif"|"mp4"|"mov"|"png">()
  const [bgcType, setBgcType] = useState<"transparent"|"solid">()
  const [colorValue, setColorValue] = useState<string>()
  return (
    <ControlPanel
      title="导出"
      actions={[]}>
      <div style={{padding: 8}}>

      <p><strong>文件格式</strong></p>
      <RadioGroup selectedValue={fileExtension} onChange={e=> setFileExtension(e.currentTarget.value as typeof fileExtension)}>
        <div>
          <Tooltip2 content={"易于预览的格式"} placement="right">
            <Radio label="动图（gif）" value={"gif"}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"易于预览的格式，不支持透明背景，较小的文件体积"} placement="right">
            <Radio label="视频（mp4）" value={"mp4"}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"支持透明背景，适合用作视频素材，较大的文件体积"} placement="right">
            <Radio label="无损视频（mov）" value={"mov"}/>
          </Tooltip2>
        </div>
        <div>
          <Tooltip2 content={"支持透明背景，便于修改，较大的文件体积"} placement="right">
            <Radio label="图片序列（png）" value={"png"}/>
          </Tooltip2>
        </div>
      </RadioGroup>
      <br/>
      <p><strong>帧率</strong></p>
      <InputGroup type="number" min={1} max={60} />
      <p><strong>背景颜色</strong></p>
      <RadioGroup selectedValue={bgcType} onChange={e=> setBgcType(e.currentTarget.value as typeof bgcType)}>
        <Radio label="透明" value={"transparent"}/>
        <Radio label="纯色" value={"solid"}/>
      </RadioGroup>
      <Button>使用当前背景色</Button>
      <div style={{padding: 5, color: "#ff0000", backgroundColor: "#fee", border: "1px solid #f00", borderRadius: 2}}>
        当前格式（mp4）不支持透明，背景色将被填充为纯黑
        当前格式（gif）在透明背景下，图像边缘可能有锯齿，这是正常现象。
      </div>
      


      </div>

    </ControlPanel>
  )

}

ControlPanel.ApiPanel = ApiPanel
ControlPanel.Export = Export

// utils
function SmallButton(props: ButtonProps) {
  return <Button {...props} small/>
}