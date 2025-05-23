import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import style from './index.module.css'
import { H5, H6, InputGroup, Tag, Button, PanelStack2, PanelProps, H4, Dialog, DialogBody, DialogFooter, Alert, useHotkeys } from '@blueprintjs/core'
import { Api, getDefaultArgs, isUnstandardApi} from '../AnimCore_Canvas/animstate'
import { useDragData } from '../../hooks'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { API_DOC } from './api_doc'
import ArgInput from '../ApiArgInput'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
const appWindow = getCurrentWebviewWindow()

const buttonStyle: React.CSSProperties = {
  margin: "4px 0",
  display: "block",
  minWidth: 180,
}

function ApiDetailPanel(props: PanelProps<{api: Api["name"]}>) {
  const {api, closePanel} = props
  const doc = API_DOC[api]
  const [apiObj, changeApiObj] = useState<any>(undefined)
  const changeApiArg = useCallback((value: any[])=> {
    changeApiObj(v=> ({...v, args: value}))
  }, [changeApiObj])

  const reset = useCallback(()=> {
    changeApiObj({name: api, args: getDefaultArgs(api)})
  }, [api])

  useEffect(()=> {
    reset()
  }, [reset])

  useEffect(()=> {
    let unlisten = appWindow.listen("clear_api_input", ()=> {
      reset()
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [reset])

  const [valid, setValid] = useState(true)
  const context = useContext(animstateContext)
  const {insertApi, getLatestApi} = context
  const onClickAdd = useCallback(()=> {
    if (!valid) {
      window.alert("Invalid parameters")
    }
    else {
      const last = getLatestApi()
      if (isUnstandardApi(apiObj["name"])){
        appWindow.emit("api_picker_alert",{
          type: "unstandard",
          api: apiObj,
        })
      }
      else if (last !== undefined && last["name"] === apiObj["name"]
        && JSON.stringify(last["args"]) === JSON.stringify(apiObj["args"])){
        appWindow.emit("api_picker_alert",{
          type: "duplicated",
          api: apiObj,
        })
      }
      else {
        insertApi(apiObj["name"], apiObj["args"])
        reset()
        appWindow.emit("toast", {message: "添加成功", intent: "success", icon: "endorsed"})
      }
    }
  }, [valid, apiObj, insertApi, getLatestApi, reset])

  const canClose = useRef(true)
  useHotkeys([
    {
      // onKeyDown: console.log,
      onKeyUp: ()=> {
        if (canClose.current){
          canClose.current = false
          closePanel()
        }
      },
      allowInInput: true,
      preventDefault: false,
      combo: "esc",
      label: "Go back",
      global: true,
    }
  ])

  const dragData = useDragData()

  const onDragStart = useCallback((e: React.DragEvent)=> {
    if (valid){
      dragData.set("source", "API_PICKER")
      dragData.set("payload", JSON.stringify(apiObj))
    }
  }, [apiObj, valid])

  const onDragEnd = useCallback(()=> {
    appWindow.emit("global_dragend", "ApiPicker")
  }, [])

  return (
    <div className={style["subpanel"]}>
      <div className={style["back-button"]}>
        <Button icon="chevron-left" minimal small onClick={()=> props.closePanel()}>返回</Button>
      </div>
      <div className={style["api-box"]}>
        <H5 style={{marginTop: 10}}>
          {api}
        </H5>
        <div className={style["arg-input-list"]}>
          <ArgInput 
            api={apiObj as any}
            onChange={(value: any, index: number)=> {
              if (index === -1) {
                changeApiArg(value) // change all
              }
              else {
                changeApiArg(apiObj.args.map((v, i)=> i === index ? value : v)) // change one
              }
            }}
            // onEdit={setEditing}
            onValidChange={setValid}
            autoFocusIndex={0}
          />
        </div>
        <Button 
          icon="add" small disabled={!valid} onClick={onClickAdd}
          draggable={valid} 
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}>
          添加
        </Button>
      </div>
      {
        Boolean(doc) && 
        <div style={{marginTop: 10, paddingTop: 0, borderTop: "1px solid #eee"}} className='bp4-running-text'>
          {
            doc.title && <H5 style={{marginTop: 10}}>{doc.title}</H5>
          }
          {doc.desc}
          {/* // TODO: add example */}
          {/* {
            doc.example && <>
              <H5>示例</H5>
              {
                doc.example
              }
            </>
          } */}
          {
            doc.desc_detail && <>
              <H5>备注</H5>
              {
                doc.desc_detail
              }
            </>
          }
        </div>
      }
    </div>
  )
}

function ApiBasicPanel(props: PanelProps<{parentRef: ()=> HTMLDivElement}>) {
  const {openPanel, closePanel, parentRef} = props
  const open = useCallback((api: string)=> {
    openPanel({
      props: {api},
      renderPanel: ApiDetailPanel,
    })
  }, [openPanel, parentRef])
  return (
    <>
      <H5>新增指令</H5>
      {/* <InputGroup placeholder='TODO:入框...' 
        inputRef={ref=> ref?.select()}
        round small 
        leftIcon={"search"} spellCheck={false}
        style={{width: "80%", marginBottom: 10}}
      /> */}
      {/* <H6>最近</H6> */}
      <H6>基础</H6>
      <div className={style["api-group"]}>
        <ApiButton name="SetBuild" onClick={()=> open("SetBuild")}/>
        <ApiButton name="SetBank" onClick={()=> open("SetBank")}/>
        <ApiButton name="PlayAnimation" onClick={()=> open("PlayAnimation")}/>
        <ApiButton name="SetBankAndPlayAnimation" onClick={()=> open("SetBankAndPlayAnimation")}/>
      </div>
      <H6>修饰</H6>
      <div className={style["api-group"]}>
        <ApiButton name="OverrideSymbol" onClick={()=> open("OverrideSymbol")}/>
        <ApiButton name="ClearOverrideSymbol" onClick={()=> open("ClearOverrideSymbol")}/>
        <ApiButton name="AddOverrideBuild" onClick={()=> open("AddOverrideBuild")}/>
        <ApiButton name="ClearOverrideBuild" onClick={()=> open("ClearOverrideBuild")}/>
        <ApiButton name="Hide" onClick={()=> open("Hide")}/>
        <ApiButton name="Show" onClick={()=> open("Show")}/>
        <ApiButton name="HideSymbol" onClick={()=> open("HideSymbol")}/>
        <ApiButton name="ShowSymbol" onClick={()=> open("ShowSymbol")}/>
      </div>
      <H6>调色</H6>
      <div className={style["api-group"]}>
        <ApiButton name="SetMultColour" onClick={()=> open("SetMultColour")}/>
        <ApiButton name="SetAddColour" onClick={()=> open("SetAddColour")}/>
        <ApiButton name="SetSymbolMultColour" onClick={()=> open("SetSymbolMultColour")}/>
        <ApiButton name="SetSymbolAddColour" onClick={()=> open("SetSymbolAddColour")}/>
      </div>
      <H6>非标准</H6>
      <div>
        <ApiButton name="PushAnimation" onClick={()=> open("PushAnimation")}/>
        <ApiButton name="SetSkin" onClick={()=> open("SetSkin")}/>
        <ApiButton name="OverrideSkinSymbol" onClick={()=> open("OverrideSkinSymbol")}/>
        <ApiButton name="SetPercent" onClick={()=> open("SetPercent")}/>
        <ApiButton name="Pause" onClick={()=> open("Pause")}/>
        <ApiButton name="Resume" onClick={()=> open("Resume")}/>
        <ApiButton name="SetDeltaTimeMultiplier" onClick={()=> open("SetDeltaTimeMultiplier")}/>
      </div>

      <hr/>
      <H5>删除/禁用指令</H5>
      <p>右键点击名字，可删除或禁用一条指令。</p>
      <H6>批量操作</H6>
      <Button icon="eye-off" style={buttonStyle}>禁用所有的错误指令</Button>
      <Button icon="eye-off" style={buttonStyle}>禁用所有的调色指令</Button>
      <Button icon="eye-open" style={buttonStyle}>启用所有的调色指令</Button>
      <Button icon="eye-open" style={buttonStyle}>启用所有的指令</Button>
      <Button icon="duplicate" style={buttonStyle} intent="danger">删除所有的重复指令</Button>
      <Button icon="warning-sign" style={buttonStyle} intent="danger">删除所有的错误指令</Button>   
    </>
  )
}

export default function ApiPicker(props: {style: React.CSSProperties}) {
  const boxRef = useRef<HTMLDivElement>()
  return (
    <div className={style["box"]} ref={boxRef} style={props.style}>
      <PanelStack2
        renderActivePanelOnly={false}
        showPanelHeader={false}
        initialPanel={{renderPanel: ApiBasicPanel, props: {parentRef: ()=> boxRef.current}}}
      />
    </div>
  )
}

function ApiButton(props: {name: Api["name"], onClick: ()=> void}) {
  const dragData = useDragData()

  const onDragStart = useCallback((e: React.DragEvent)=> {
    dragData.set("source", "API_PICKER")
    dragData.set("payload", JSON.stringify({name: props.name}))
  }, [props.name])

  const onDragEnd = useCallback(()=> {
    appWindow.emit("global_dragend", "ApiPicker")
  }, [])

  return (
    <div style={{display: "inline-block", margin: 2}}
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={props.onClick}
    >
      <Tag interactive minimal>
        <span className='bp4-monospace-text'>
          {props.name}
        </span>
      </Tag>
    </div>
  )
}