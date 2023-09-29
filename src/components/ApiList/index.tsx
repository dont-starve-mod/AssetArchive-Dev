import React, { useCallback, useEffect, useReducer, useState, useContext, useMemo, useRef } from 'react'
import { AnimState, Api, ApiArgType } from '../AnimCore_Canvas/animstate'
import style from './index.module.css'
import { MenuItem, Menu, EditableText, Tag, Switch, Checkbox, useHotkeys } from '@blueprintjs/core'
import { useDragData } from '../../hooks'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { appWindow } from '@tauri-apps/api/window'
import { v4 as uuidv4 } from 'uuid'
import ArgInput from '../ArgInput'
import AnimProjectInitFromParam from '../AnimProjectInitFromParam'

interface ApiListProps {

}

export default function ApiList(props: ApiListProps) {
  const {animstate, 
    insertApi, 
    enableApi, 
    disableApi, 
    rearrange} = useContext(animstateContext)
  const [initDialog, setInitDialog] = useState<"asset"|"animstate"|"none">("none")
  const api_list: Api[] = animstate.getApiList()

  const onConfirm = useCallback(({bank, build, animation}: {[K: string]: string})=> {
    console.log(build, bank, animation)
    // TODO: need some warning if param is valid?
    insertApi("SetBuild", [build])
    insertApi("SetBankAndPlayAnimation", [bank, animation])
    setInitDialog("none")
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
            api_list.map((api, index)=> 
              <ApiItem key={api.uuid} {...api} index={index}/>)
          }
        </ul>
      </div>
      <AnimProjectInitFromParam isOpen={initDialog !== "none"} onClose={()=> setInitDialog("none")} onConfirm={onConfirm}/>
    </>
  )
}

// TODO: 需要给最下方的API更大的拖拽判定区
function ApiItem(props: Api & {index: number}){
  const {name, args, disabled} = props
  const apiNameStyle: React.CSSProperties = {fontWeight: 600}
  const apiArgStyle: React.CSSProperties = {color: "#666"}
  const [unfold, setUnfold] = useState(false)
  const [editing, setEditing] = useState(-1)
  const fmt = (value: any)=> typeof value === "string" ? JSON.stringify(value) :
    typeof value === "boolean" ? (value ? "true" : "false") :
    typeof value === "number" ? JSON.stringify(value) :
    (value === undefined || value === null) ? "nil" :
    "UNKNOWN"
  const text = useMemo(()=> {
    if (unfold) {
      return <span style={apiNameStyle}>{name}</span>
    }
    const result = []
    result.push(<span style={apiNameStyle}>{name+"("}</span>)
    args.forEach((arg, index)=> {
      result.push(<span onClick={()=> setEditing(index)} 
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
  }, [name, args, disabled, unfold])

  const dragData = useDragData()
  const dragArea = useRef<HTMLDivElement>()
  const [dragging, setDragging] = useState(false)
  const [insertPosition, setInsertPosition] = useState<"up"|"down"|"none">("none")
  const onDragStart = useCallback((e: React.DragEvent)=> {
    setDragging(true)
    dragData.set("source", "API")
    dragData.set("payload", JSON.stringify({index: props.index}))
  }, [props])

  const onDragEnd = useCallback((e: React.DragEvent)=> {
    setDragging(false)
    appWindow.emit("global_dragend")
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
    if (source === null || index === props.index)
      return
    await appWindow.emit("global_dragend")
    setInsertPosition(calcInsertPosition(e))
  }, [props])

  const {rearrange, insertApi, disableApi, enableApi, changeApiArg} = useContext(animstateContext)

  const onDrop = useCallback(async (e: React.DragEvent)=> {
    const source = await dragData.get("source")
    const payload = await dragData.get("payload")
    const { index, name } = JSON.parse(payload)
    if (source === null || index === props.index)
      return
    const pos = calcInsertPosition(e)
    const newIndex = props.index + (pos === "up" ? 0 : 1)
    if (source === "API_PICKER") {
      insertApi(name, [], newIndex)
    }
    else if (source === "API") {
      rearrange(index, newIndex)
    }
    setInsertPosition("none")
  }, [props])

  useEffect(()=> {
    const unlisten = appWindow.listen("global_dragend", 
      ()=> setInsertPosition("none"))
    return ()=> {unlisten.then(f=> f())}
  }, [])

  return (
    <div ref={dragArea} style={{position: "relative", opacity: dragging ? 0.5 : 1}}
      onDragOver={onDragOver}
      onDragLeave={()=> setInsertPosition("none")}
      onDrop={onDrop}
      >
      <div className={style["insert-up"]}
        style={{display: (insertPosition === "up") ? "block" : "none"}}></div>
      <div className={style["insert-down"]}
        style={{display: (insertPosition === "down") ? "block" : "none"}}></div>
      <MenuItem
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        text={text} 
        intent='primary' 
        style={{padding: "2px 4px", color: disabled ? "#aaa" : undefined}}
        // labelElement={<Button icon="eye-on" small minimal></Button>} 
        onClick={()=> setUnfold(v=> {
          if (v) {
            setEditing(-1)
          }
          return !v
        })}
      />
      {
        unfold && <ul className={style["arg-list"]}>
          {/* <span>开启</span>
          <Checkbox checked={!disabled} onChange={()=> {
            if (disabled)
              enableApi(props.index)
            else {
              disableApi(props.index)
            }
          }} inline/> */}
          <ArgInput 
            api={props} 
            onChange={(value: any, index: number)=> {
              if (index === -1) {
                changeApiArg(props.index, value) // change all
              }
              else {
                changeApiArg(props.index, args.map((v, i)=> i === index ? value : v)) // change one
              }
            }}

            onEdit={setEditing}
            editing={editing}
          />
          {/* { 
          //@ts-ignore
            args.map((arg: string, index: number)=> 
            <div style={{...apiArgStyle, margin: "4px 0"}}>
              <ArgInput 
                value={arg}
                onChange={value=> changeApiArg(props.index, args.map((v, i)=> i === index ? value : v))}
                onFocus={()=> setEditing(index)}
                inputRef={(input)=> 
                  index === editing && input && input.focus()
              }/>
            </div>
            )
          } */}
        </ul>
      }
    </div>
  )
}
