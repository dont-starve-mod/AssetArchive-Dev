import React, { useCallback, useEffect, useReducer, useState } from 'react'
import { Api } from '../AnimCore_Canvas/animstate'
import style from './index.module.css'
import { Button, Dialog, DialogBody, DialogFooter, H5, Label, Icon, InputGroup } from '@blueprintjs/core'
import { Classes } from '@blueprintjs/core'
import { InputSharedProps } from '@blueprintjs/core/lib/esm/components/forms/inputSharedProps'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
// import { PREDICT } from '../../renderer_predict_worker'
import { PREDICT } from '../../workers'

export default function ApiList() {
  const [initDialog, setInitDialog] = useState<"asset"|"animstate"|null>()
  const api_list: Api[] = [
    {name: "SetBuild", args: ["wilson"]},
    {name: "SetBankAndPlayAnimation", args: ["wilson", "idle_loop"]},
    {name: "SetMultColour", args: [1, 0, 1, 0]},
    {name: "SetAddColour", args: [1, 1, 0, 0]},
  ]

  return (
    <>
      <div className={style["api-list"]}>
        {
          // api_list.length === 0 && 
          <div style={{color: "#999"}} className='bp4-running-text'>
            <p>这里什么都没有，你可以: </p>
            {/* <br/> */}
            <p><a onClick={()=> setInitDialog("asset")}>从资源包初始化项目</a></p>
            <p>或者</p>
            <p><a onClick={()=> setInitDialog("animstate")}>手动设置材质 & 动画</a></p>
          </div>
        }
        {
          api_list.map(api=> {
            return <></>
          })
        }
      </div>
      <InitDialog isOpen={initDialog !== null} onClose={()=> setInitDialog(null)}/>
    </>
  )
}

function ApiItem(props: Api){
  const {name, args, disabled} = props
  return (
    <div>

    </div>
  )
}

type initData = {
  build: [string, boolean],
  bank: [string, boolean],
  animation: [string, boolean],
}

type initAction = {
  type: keyof initData,
  payload: {
    value?: string,
    focus?: boolean,
  },
}

const initDataReducer: React.Reducer<initData, initAction> = (state, action)=> {
  const {type, payload} = action
  const v = state[type]
  if (payload.value !== undefined) v[0] = payload.value
  if (payload.focus !== undefined) v[1] = payload.focus
  return {
    ...state,
    [type]: v,
  }
}

function InitDialog(props: {isOpen?: boolean, onClose: any}) {
  const inputClass = [Classes.INPUT, style["input"]].join(" ")
  const [initData, dispatch] = useReducer(initDataReducer, 
    {build: ["", false], bank: ["", false], animation: ["", false]})
  
  return (
    <Dialog title="初始化" 
      style={{width: 400}}
      isOpen={props.isOpen} onClose={props.onClose}>
      <DialogBody>
        <Label>
          材质 / Build 
          <InitInput field={"build"} state={initData} dispatch={dispatch} autoFocus/>
        </Label>
        <Label>
          动画库 / Bank 
          <InitInput field={"bank"} state={initData} dispatch={dispatch}/>
        </Label>
        <Label>
          动画 / Animation 
          <InitInput field={"animation"} state={initData} dispatch={dispatch}/>
        </Label>
      </DialogBody>
      <DialogFooter actions={
        <Button intent='primary' onClick={()=> window.alert(JSON.stringify(initData))}>确认</Button>
      }/>
    </Dialog>
  )
}

function InitInput(props: {
  state: initData,
  field: "build" | "bank" | "animation",
  dispatch: (value: initAction)=> void,
  autoFocus?: true,
} & InputSharedProps) {
  const inputClass = [Classes.INPUT, Classes.FILL, style["input"]].join(" ")
  const {dispatch, field} = props
  const [value, focus] = props.state[field]
  const onRef = useCallback((input?: HTMLInputElement)=> {
    if (props.autoFocus && input)
      input.focus()
  }, [props.autoFocus])
  const warning = focus

  const onChange = useCallback(async ({target: {value}})=> {
    dispatch({type: field, payload: {value}})
    if (value !== "") {
      // search for predict
      PREDICT.search(field, value).then(
        response=> console.log(response),
        error=> console.log(error)
      )

    }
  }, [])

  return (
    <div style={{width: "100%"}}>
      <div style={{display: "inline-block", width: "85%", marginRight: 10}}>
        <Popover2 
          isOpen={focus}
          autoFocus={false}
          enforceFocus={false}
          content={'233'}
          placement={"bottom-start"}
          minimal
          className={"bp4-suggest-popover"}
          popoverClassName={style["inline"]}
        >
          <input 
            className={inputClass}
            spellCheck={false}
            value={value}
            ref={onRef}
            onFocus={()=> dispatch({type: field, payload: {focus: true}})}
            onBlur={()=> dispatch({type: field, payload: {focus: false}})}
            onChange={onChange}/>
        </Popover2>
      </div>
      <div style={{display: warning ? "inline-block" : "none"}}>
        {/* <Tooltip2 content={'这是一段警告'}> */}
          <Button
            active={false} 
            style={{verticalAlign: "center"}} 
            icon="error" 
            intent="danger" 
            minimal/>
        {/* </Tooltip2> */}
      </div>
    </div>
  )
}