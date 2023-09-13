import React from 'react'
import { Popover2 } from '@blueprintjs/popover2'
import style from './index.module.css'
import { H6, InputGroup, Tag } from '@blueprintjs/core'
import { Api, SkeletonApi, SwapApi, RenderApi } from '../AnimCore_Canvas/animstate'

interface IProps {

}

export default function ApiPicker(props: IProps) {
  return (
    <div className={style["box"]}>
      <InputGroup placeholder='...' 
        round small 
        leftIcon={"search"} spellCheck={false}
        style={{width: "80%", marginBottom: 10}}
      />
      {/* <H6>最近</H6> */}
      <H6>基础</H6>
      <div className={style["api-group"]}>
        <ApiButton name="SetBuild"/>
        <ApiButton name="SetBankAndPlayAnimation"/>
        <ApiButton name="SetBank"/>
        <ApiButton name="PlayAnimation"/>
      </div>
      <H6>修饰</H6>
      <div className={style["api-group"]}>
        <ApiButton name="OverrideSymbol"/>
        <ApiButton name="ClearOverrideSymbol"/>
        <ApiButton name="AddOverrideBuild"/>
        <ApiButton name="ClearOverrideBuild"/>
        <ApiButton name="Show"/>
        <ApiButton name="Hide"/>
        <ApiButton name="ShowSymbol"/>
        <ApiButton name="HideSymbol"/>
      </div>
      <H6>调色</H6>
      <div className={style["api-group"]}>
        <ApiButton name="SetMultColour"/>
        <ApiButton name="SetAddColour"/>
        <ApiButton name="SetSymbolMultColour"/>
        <ApiButton name="SetSymbolAddColour"/>
      </div>
      <H6>非标准</H6>
      <div>
        <ApiButton name="PushAnimation"/>
        <ApiButton name="SetSkin"/>
        <ApiButton name="OverrideSkinSymbol"/>
        <ApiButton name="SetPercent"/>
        <ApiButton name="Pause"/>
        <ApiButton name="Resume"/>
        <ApiButton name="SetDeltaTimeMultiplier"/>
      </div>
    </div>
  )
}

function ApiButton(props: {name: Api["name"]}) {
  return (
    <div style={{display: "inline-block", margin: 2}}>
      <Tag interactive minimal>
        <span className='bp4-monospace-text'>
          {props.name}
        </span>
      </Tag>
    </div>
  )
}