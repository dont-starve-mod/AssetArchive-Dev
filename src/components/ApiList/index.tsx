import React, { useCallback, useEffect, useReducer, useState, useContext, useMemo, useRef } from 'react'
import { AnimState, Api, ApiArgType } from '../AnimCore_Canvas/animstate'
import style from './index.module.css'
import { Button, Dialog, DialogBody, DialogFooter, H5, Label, Icon, InputGroup, MenuItem, Menu, EditableText, Tag } from '@blueprintjs/core'
import { Classes } from '@blueprintjs/core'
import { InputSharedProps } from '@blueprintjs/core/lib/esm/components/forms/inputSharedProps'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { predict } from '../../asyncsearcher'
import { FuseResult } from '../../renderer_predict'
import { Suggest2 } from '@blueprintjs/select'
import { useDragData } from '../../hooks'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { appWindow } from '@tauri-apps/api/window'
import { v4 as uuidv4 } from 'uuid'

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
      <InitDialog isOpen={initDialog !== "none"} onClose={()=> setInitDialog("none")} onConfirm={onConfirm}/>
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

  const {rearrange, insertApi} = useContext(animstateContext)

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
        style={{}}
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
          {
            args.map((arg: any, index: number)=> 
            <div style={{...apiArgStyle, margin: "4px 0"}}>
              <Icon icon="nest" size={16} style={{marginRight: 4}}/>
              <EditableText 
                defaultValue={arg} 
                onEdit={()=> console.log("EDIT")}
                isEditing={index === editing}/>
            </div>
            )
          }
        </ul>
      }
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

function InitDialog(props: {
  isOpen?: boolean,
  onClose: ()=> void, 
  onConfirm: (data: {build: string, bank: string, animation: string})=> void}) {

  const inputClass = [Classes.INPUT, style["input"]].join(" ")
  const [initData, dispatch] = useReducer(initDataReducer, 
    {build: ["", false], bank: ["", false], animation: ["", false]})
  const onClick = useCallback(()=> {
    props.onConfirm({
      build: initData.build[0],
      bank: initData.bank[0],
      animation: initData.animation[0],
    })
  }, [props.onConfirm])
  return (
    <Dialog title="初始化" 
      style={{width: 400}}
      isOpen={props.isOpen} onClose={props.onClose}>
      <DialogBody>
        <div>
          材质 / Build 
          <InitInput field={"build"} state={initData} dispatch={dispatch} autoFocus/>
        </div>
        <div>
          动画库 / Bank 
          <InitInput field={"bank"} state={initData} dispatch={dispatch} caseSensitive={false}/>
        </div>
        <div>
          动画 / Animation 
          <InitInput field={"animation"} state={initData} dispatch={dispatch} bankValue={initData.bank[0]}/>
        </div>
      </DialogBody>
      <DialogFooter actions={
        <Button intent='primary' onClick={onClick}>确认</Button>
      }/>
    </Dialog>
  )
}

function InitInput(props: {
  state: initData,
  field: "build" | "bank" | "animation",
  dispatch: (value: initAction)=> void,
  autoFocus?: true,
  caseSensitive?: boolean,
  bankValue?: string,
} & InputSharedProps) {
  const inputClass = [Classes.INPUT, Classes.FILL, style["input"]].join(" ")
  const {dispatch, field, caseSensitive, bankValue} = props
  const [value, focus] = props.state[field]
  const onRef = useCallback((input?: HTMLInputElement)=> {
    if (props.autoFocus && input)
      input.focus()
  }, [props.autoFocus])
  
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const getItemValue = item=> item.matches[0].value
  const bestMatchValue: string = items.length > 0 && getItemValue(items[0])
  const exists = items.length > 0 && (
    bestMatchValue === value ||
    caseSensitive === false && bestMatchValue.toLowerCase() === value.toLocaleLowerCase()
  )
  const warning = value.length > 0 && !exists && !loading
  const warningHint = <>
    参数无效
    { bestMatchValue && <>{`，你是否指的是“${bestMatchValue}”？`}</> }
  </>
  const warningCb = ()=> {
    if (bestMatchValue)
      dispatch({type: field, payload: {value: bestMatchValue}})
  }

  const onQueryChange = useCallback(async (value: string)=> {
    if (field !== "animation") {
      dispatch({type: field, payload: {value}})
      if (value !== "") {
        setLoading(true)
        const result = await predict.search(field, value)
        setItems(result)
        setLoading(false)
      }
    }
  }, [])

  useEffect(()=> {
    onQueryChange(value)
  }, [onQueryChange])

  const onAnimationQueryChange = useCallback(async (value: string)=> {
    if (field === "animation") {
      dispatch({type: "animation", payload: {value}})
      if (value !== "") {
        setLoading(true)
        const result = await predict.search("animation", {bank: bankValue, animation: value})
        setItems(result)
        setLoading(false)
      }
    }
  }, [bankValue])

  useEffect(()=> {
    // refresh anim predict after change bankValue
    onAnimationQueryChange(value)
  }, [onAnimationQueryChange])

  return (
    <div style={{width: "100%"}}>
      <div style={{display: "inline-block", width: "85%", marginRight: 10}}>
        {/* <Popover2 
          isOpen={focus && items.length > 0}
          autoFocus={false}
          enforceFocus={false}
          matchTargetWidth={true}
          content={<PredictList items={items} onClick={(v)=> console.log(v)}/>}
          placement={"bottom-start"}
          minimal
          interactionKind="click"
          targetProps={{style: {display: "block"}}}
          className={"bp4-suggest-popover"}
          popoverClassName={style["inline"]}>
          <input 
            className={inputClass}
            spellCheck={false}
            value={value}
            ref={onRef}
            onFocus={()=> dispatch({type: field, payload: {focus: true}})}
            onBlur={(e)=> {
              e.stopPropagation()
              setTimeout(()=> dispatch({type: field, payload: {focus: false}}), 200)
            }}
            onChange={onChange}/>
        </Popover2> */}

        <Suggest2
          items={[]}
          itemListPredicate={()=> items}
          itemListRenderer={()=> items.length ? 
            <PredictList<any> 
              items={items} 
              onClickItem={item=> 
                dispatch({type: field, payload: {value: getItemValue(item)}})
              }/> : <></>}
          fill={true}
          closeOnSelect={true}
          inputValueRenderer={getItemValue}
          // TODO: select / key up/down to choose
          // onItemSelect={v=> dispatch({type: field, payload: {focus: false, value: v}})}
          // selectedItem={()=> items.find(v=> v.matches[0].value === value) || null}
          // onItemSelect={v=> console.log("Select", v)}
          query={value}
          onQueryChange={field !== "animation" ? onQueryChange : onAnimationQueryChange}
          popoverProps={{minimal: true, matchTargetWidth: true}}
          inputProps={{spellCheck: false, placeholder: "", style: {margin: "10px 0"}}}
        />
      </div>
      <div style={{display: (warning || exists || loading) ? "inline-block" : "none"}}>
        <Tooltip2 content={warning ? warningHint : ""} placement="top-end" disabled={!warning}>
          <Button
            active={false} 
            loading={loading}
            style={{verticalAlign: "center"}} 
            icon={warning ? "error" : exists ? "tick-circle" : "more"}
            intent={warning ? "danger" : exists ? "success" : loading ? "none" : "primary"}
            onClick={warning ? warningCb : null}
            minimal/>
        </Tooltip2>
      </div>
    </div>
  )
}

function PredictList<T>(props: {items: FuseResult<T>[], onClickItem: (item: FuseResult<T>)=> void}) {
  // TODO: highlight match
  return (
    <div style={{maxHeight: 300, overflow: "auto", overscrollBehavior: "none"}}>
      <Menu>
        {
          props.items.map(item=> 
            <MenuItem 
              id={item.matches[0].value}
              key={item.refIndex}
              // roleStructure="listoption"
              onClick={()=> {props.onClickItem(item)}}
              text={item.matches[0].value}
            />)
        }
      </Menu>
    </div>
  )

}