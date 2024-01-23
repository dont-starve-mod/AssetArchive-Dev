import React, { useCallback, useEffect, useReducer, useState, useContext, useMemo, useRef } from 'react'
import { AnimState, Api, ApiArgType, getDefaultArgs, isUnstandardApi } from '../AnimCore_Canvas/animstate'
import style from './index.module.css'
import { MenuItem, Menu, Alert } from '@blueprintjs/core'
import { useDragData } from '../../hooks'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { appWindow } from '@tauri-apps/api/window'
import ApiArgInput from '../ApiArgInput'
import AnimProjectInitFromParam from '../AnimProjectInitFromParam'
import { ContextMenu2, ContextMenu2Popover, Popover2 } from '@blueprintjs/popover2'
import { showContextMenu, hideContextMenu } from '@blueprintjs/popover2'

export default function ApiList() {
  const {animstate, 
    insertApi,
    enableApi, 
    disableApi, 
    rearrange} = useContext(animstateContext)
  const [initDialog, setInitDialog] = useState<"asset"|"animstate"|"none">("none")
  const api_list: Api[] = animstate.getApiList()
  const [insertPosition, setInsertPosition] = useState(-1)

  const onConfirm = useCallback(({bank, build, animation}: {[K: string]: string})=> {
    insertApi("SetBuild", [build])
    insertApi("SetBank", [bank])
    insertApi("PlayAnimation", [animation])
    setInitDialog("none")
  }, [])

  // TODO: fix this bug
  useEffect(()=> {
    let unlisten = appWindow.listen("global_dragend", ()=> {
      setInsertPosition(-1)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [setInsertPosition])

  // useEffect(()=> {
  //   const onMouseUp = ()=> {console.log("UP"); setInsertPosition(-1)}
  //   document.addEventListener("dragend", onMouseUp)
  //   return ()=> document.removeEventListener("dragend", onMouseUp)
  // }, [])

  // alert ui when adding duplicated api
  const [alertData, setAlertData] = useState<{type: "duplicated" | "unstandard", api?: Api, newIndex?: number}>()
  const onConfirmAlert = useCallback(()=> {
    const {type, api} = alertData
    if (type === "duplicated" || type === "unstandard") {
      insertApi(api["name"], api["args"], alertData.newIndex)
      appWindow.emit("clear_api_input")
      setAlertData(undefined)
    }
  }, [alertData, insertApi])

  useEffect(()=> {
    let unlisten = appWindow.listen("api_picker_alert", ({payload})=> {
      setAlertData(payload as any)
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  return (
    <>
      <div className={style["api-list-container"]}>
        {
          api_list.length === 0 && 
          <div style={{color: "#999"}} className='bp4-running-text'>
            <p>这里什么都没有，你可以: </p>
            {/* <br/> */}
            <p><a onClick={()=> [setInitDialog("none"), window.alert("这个功能还在写")]}>从资源包初始化项目</a></p>
            <p>或者</p>
            <p><a onClick={()=> setInitDialog("animstate")}>手动设置材质 & 动画</a></p>
          </div>
        }
        <ul className={style["api-list"]}>
          {
            api_list.map((api, index)=> <>
              { index === 0 && <InsertHint key={-1} visible={insertPosition === 0}/>}
              <ApiItem key={api.uuid} {...api} index={index} onInsertHover={setInsertPosition}/>
              <InsertHint key={index} visible={insertPosition === index + 1}/>
            </>)
          }
        </ul>
      </div>
      <AnimProjectInitFromParam 
        isOpen={initDialog !== "none"} 
        onClose={()=> setInitDialog("none")}
        onConfirm={onConfirm}/>
      <Alert isOpen={Boolean(alertData)}
        canEscapeKeyCancel={true}
        canOutsideClickCancel={false}
        cancelButtonText="取消"
        confirmButtonText="确定"
        intent="warning"
        onCancel={()=> setAlertData(undefined)}
        onConfirm={onConfirmAlert}>
        {
          Boolean(alertData) && <>
            正在添加一条<strong>
              {alertData.type === "duplicated" ? "重复" : "非标准"}
            </strong>的指令，是否继续？
          </>
        }
      </Alert>
    </>
  )
}

function InsertHint(props: {visible: boolean}){
  return (
    <div style={{
      width: "100%", height: 2, 
      backgroundColor: props.visible ? "rgb(117, 98, 212)" : "#ddd",
    }}>
    </div>
  )
}

// TODO: 需要给最下方的API更大的拖拽判定区
function ApiItem(props: Api & {index: number, onInsertHover: (index: number)=> void}){
  const {name, args, disabled, fold} = props
  const {onInsertHover} = props
  const apiNameStyle: React.CSSProperties = {fontWeight: 600}
  const apiArgStyle: React.CSSProperties = {color: "#666"}
  const autoFocusIndexRef = useRef(-1)
  const fmt = (value: any)=> typeof value === "string" ? JSON.stringify(value) :
    typeof value === "boolean" ? (value ? "true" : "false") :
    typeof value === "number" ? value.toFixed(2) :
    (value === undefined || value === null) ? "nil" :
    "UNKNOWN"
  const text = useMemo(()=> {
    if (!fold) {
      return <span style={apiNameStyle}>{name}</span>
    }
    const result = []
    result.push(<span style={apiNameStyle}>{name+"("}</span>)
    args.forEach((arg, index)=> {
      result.push(<span onClick={()=> autoFocusIndexRef.current = index}
        style={apiArgStyle}
        className={`bp4-monospace-text ${style["arg-hover"]}`}>
          {fmt(arg)}
        </span>)
      result.push(<span>,&nbsp;</span>)
    })
    if (result.length > 1)
      result.pop() // pop last comma

    result.push(<span style={apiNameStyle}>{")"}</span>)
    return result
  }, [name, args, disabled, fold])

  const dragData = useDragData()
  const dragArea = useRef<HTMLDivElement>()
  const [dragging, setDragging] = useState(false)
  const onDragStart = useCallback((e: React.DragEvent)=> {
    setDragging(true)
    dragData.set("source", "API")
    dragData.set("payload", JSON.stringify({index: props.index, fold}))
  }, [props])

  const onDragEnd = useCallback((e: React.DragEvent)=> {
    setDragging(false)
    appWindow.emit("global_dragend", "ApiList")
  }, [props])

  const calcInsertPosition = useCallback((e: React.DragEvent)=> {
    if (dragArea.current) {
      const {top, bottom} = dragArea.current.getBoundingClientRect()
      const center = (top + bottom) / 2
      const py = e.clientY
      return py < center ? "up" : "down"
    }
  }, [])

  const onDragOver = useCallback(async (e: React.DragEvent)=> {
    e.preventDefault()
    const source = await dragData.get("source")
    const payload = await dragData.get("payload")
    const { index } = JSON.parse(payload)
    if (source === null )
      return

    onInsertHover(props.index + (calcInsertPosition(e) === "up" ? 0 : 1))
  }, [props])

  const {rearrange, insertApi, disableApi, enableApi, deleteApi,
    changeApiArg, toggleFoldApi, getLatestApi} = useContext(animstateContext)

  const onDrop = useCallback(async (e: React.DragEvent)=> {
    const source = await dragData.get("source")
    const payload = await dragData.get("payload")
    let { index, name, args } = JSON.parse(payload)
    if (source === null || index === props.index)
      return
    const pos = calcInsertPosition(e)
    const newIndex = props.index + (pos === "up" ? 0 : 1)
    if (source === "API_PICKER") {
      if (typeof args === "undefined")
        args = getDefaultArgs(name)
      const last = getLatestApi()
    
      if (isUnstandardApi(name)){
        appWindow.emit("api_picker_alert",{
          type: "unstandard",
          api: {name, args},
          newIndex,
        })
      }
      else if (last !== undefined && last["name"] === name
        && JSON.stringify(last["args"]) === JSON.stringify(args)){
        appWindow.emit("api_picker_alert",{
          type: "duplicated",
          api: {name, args},
          newIndex,
        })
      }
      else {
        insertApi(name, args, newIndex)
        appWindow.emit("clear_api_input")
      }
    }
    else if (source === "API") {
      rearrange(index, newIndex)
    }
    onInsertHover(-1)
  }, [props, onInsertHover, getLatestApi])

  const menu = useMemo(()=> 
    <Menu style={{width: 100, maxWidth: 100}}>
      {
        props.disabled ? 
        <MenuItem icon="eye-open" text="启用" onClick={()=> enableApi(props.index)} /> :
        <MenuItem icon="eye-off" text="禁用" onClick={()=> disableApi(props.index)} /> 
      }
      <MenuItem icon="trash" text="删除" intent="danger" onClick={()=> deleteApi(props.index)}/>
    </Menu>
  , [props])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault()
      showContextMenu({
          content: menu,
          onClose: ()=> hideContextMenu(),
          targetOffset: {
              left: e.clientX,
              top:  e.clientY,
          },
      })
  }, [menu])

  return (
    <div ref={dragArea} 
      style={{position: "relative", padding: "4px",
        opacity: dragging ? 0.2 : 1,
        transition: "all 0.1s linear",
        filter: props.disabled ? "grayscale(80%) opacity(50%)" : undefined
      }}
      className={fold ? style["api-item-fold"] : ""}
      onDragOver={onDragOver}
      onDragLeave={()=> onInsertHover(-1)}
      onDrop={onDrop}
      >
      <div onContextMenu={handleContextMenu}>
        <MenuItem
          draggable
          multiline
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          text={text} 
          intent="primary"
          style={{padding: "2px 4px", color: disabled ? "#aaa" : undefined}}
          onClick={()=> {
            if (!toggleFoldApi(props.index)){
              // reset index when folding ui
              autoFocusIndexRef.current = -1
            }
          }}
        />
      </div>
      {
        !fold && <div className={style["arg-list"]}>
          {/* <span>开启</span>
          <Checkbox checked={!disabled} onChange={()=> {
            if (disabled)
              enableApi(props.index)
            else {
              disableApi(props.index)
            }
          }} inline/> */}
          <ApiArgInput
            api={props} 
            onChange={(value: any, index: number)=> {
              if (index === -1) {
                changeApiArg(props.index, value) // change all
              }
              else {
                changeApiArg(props.index, args.map((v, i)=> i === index ? value : v)) // change one
              }
            }}
            autoFocusIndex={autoFocusIndexRef.current}
            autoFocusDelay={100}
            autoFocusType={"select"}
            onValidChange={()=> {}}
          />
        </div>
      }
    </div>
  )
}
