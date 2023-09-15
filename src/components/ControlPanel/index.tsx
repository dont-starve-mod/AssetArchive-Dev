import React, { Children, useState } from 'react'
import { Button, ButtonGroup, ButtonProps, Collapse, H5, Icon, IconName } from '@blueprintjs/core'
import style from './index.module.css'
import ApiPicker from '../ApiPicker'
import ApiList from '../ApiList'
import { Popover2 } from '@blueprintjs/popover2'

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
  const [unfold, setUnfold] = useState(false)
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
  return <>
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
  </>
}

function Skeleton() {

}

function Swap() {

}

function ColourPalette() {

}

ControlPanel.ApiPanel = ApiPanel


// utils
function SmallButton(props: ButtonProps) {
  return <Button {...props} small/>
}