import { Dialog, DialogBody, DialogFooter, Button, Menu, MenuItem, Classes, } from "@blueprintjs/core"
import { InputSharedProps } from "@blueprintjs/core/lib/esm/components/forms/inputSharedProps"
import { Suggest2 } from "@blueprintjs/select"
import { Tooltip2 } from "@blueprintjs/popover2"
import { useState, useCallback, useEffect, useReducer, useRef } from "react"
import type { FuseResult } from "../../renderer_predict"
import { predict } from "../../asyncsearcher"
import style from "./index.module.css"

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

enum SearchId {
  Bank = "Bank",
  Build = "Build",
  Animation = "Animation",
}

export default function AnimProjectInitFromParam(props: {
  isOpen?: boolean,
  onClose: ()=> void, 
  onConfirm: (data: {build: string, bank: string, animation: string})=> void}) {

  // const inputClass = [Classes.INPUT, style["input"]].join(" ")
  const [initData, dispatch] = useReducer(initDataReducer, 
    {build: ["", false], bank: ["", false], animation: ["", false]})
  const {onConfirm} = props
  const onClick = useCallback(()=> {
    // TODO: 当参数无效时，弹出警告
    onConfirm({
      build: initData.build[0],
      bank: initData.bank[0],
      animation: initData.animation[0],
    })
  }, [onConfirm, initData.build, initData.bank, initData.animation])
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
  const getItemValue = (item: FuseResult<any>) => item.matches[0].value
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

  const [selectedItem, setSelectedItem] = useState(0)

  const onQueryChange = useCallback(async (value: string)=> {
    if (field !== "animation") {
      dispatch({type: field, payload: {value}})
      if (value !== "") {
        setLoading(true)
        const result = await predict.search(field, value, field === "bank" ? SearchId.Bank : SearchId.Build)
        setItems(result)
        setLoading(false)
      }
    }
  }, [dispatch, field])

  useEffect(()=> {
    onQueryChange(value)
  }, [onQueryChange, value])

  const onAnimationQueryChange = useCallback(async (value: string)=> {
    if (field === "animation") {
      dispatch({type: "animation", payload: {value}})
      if (value !== "") {
        setLoading(true)
        const result = await predict.search("animation", {bank: bankValue, animation: value}, SearchId.Animation)
        setItems(result)
        setLoading(false)
      }
    }
  }, [bankValue, dispatch, field])

  useEffect(()=> {
    // refresh anim predict after change bankValue
    onAnimationQueryChange(value)
  }, [onAnimationQueryChange, value])

  const onQueryChangeAll = useCallback((query: string)=> {
    if (field !== "animation"){
      onQueryChange(query)
    }
    else {
      onAnimationQueryChange(query)
    }
    setSelectedItem(0)
  }, [onQueryChange, onAnimationQueryChange, setSelectedItem, field])

  const inputRef = useRef<any>()
  const isFocus = useCallback(()=> {
    return document.activeElement === (inputRef.current && inputRef.current.inputElement)
  }, [])

  useEffect(()=> {
    const onKey = (event: KeyboardEvent)=> {
      if (items.length > 0 && event.defaultPrevented === true && isFocus()){
        const {key} = event
        if (key === "ArrowUp") {
          setSelectedItem(v=> Math.max(0, v - 1))
        }
        else if (key === "ArrowDown") {
          setSelectedItem(v=> Math.min(v + 1, items.length - 1))
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return ()=> window.removeEventListener("keydown", onKey)
  }, [items, setSelectedItem, isFocus])

  const onItemSelect = useCallback(({item})=> {
    onQueryChange(item[field])
  }, [onQueryChange, field])

  return (
    <div style={{width: "100%"}}>
      <div style={{display: "inline-block",  width: "85%", marginRight: 10}}>
        <Suggest2
          ref={inputRef}
          items={[]}
          itemListPredicate={()=> items}
          itemListRenderer={()=> items.length ? 
            <PredictList<any> 
              items={items} 
              selectedItem={selectedItem}
              onClickItem={item=> 
                dispatch({type: field, payload: {value: getItemValue(item)}})
              }/> : <></>}
          fill={true}
          closeOnSelect={true}
          inputValueRenderer={getItemValue}
          activeItem={items[selectedItem]}
          onItemSelect={onItemSelect}
          query={value}
          onQueryChange={onQueryChangeAll}
          popoverProps={{minimal: true, matchTargetWidth: true}}
          inputProps={{spellCheck: false, placeholder: "", style: {margin: "10px 0"}}}
        /> 
      </div>
      <div style={{display: (warning || exists || loading) ? "inline-block" : "none"}}>
        <Tooltip2 content={warning ? warningHint : ""} placement="top-end" disabled={!warning} intent="danger">
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

function PredictList<T>(props: {items: FuseResult<T>[], 
  selectedItem: number, onClickItem: (item: FuseResult<T>)=> void}) {
  return (
    <div style={{maxHeight: 300, overflow: "auto", overscrollBehavior: "none"}}>
      <Menu>
        {
          props.items.map((item, index)=> 
            <MenuItem 
              id={item.matches[0].value}
              key={item.refIndex}
              selected={props.selectedItem === index}
              // roleStructure="listoption"
              onClick={()=> {props.onClickItem(item)}}
              text={item.matches[0].value}
            />)
        }
      </Menu>
    </div>
  )
}