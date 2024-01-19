import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { InputGroup, Intent, Slider, Tag } from '@blueprintjs/core'
import style from './index.module.css'
import { Tooltip2 } from '@blueprintjs/popover2'
import { AnimState, Api, BasicApi } from '../AnimCore_Canvas/animstate'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { useBasicPredicter, useGlobalAnimState, useHashPredicter, usePredicterFormatter, useValidFlags } from "./predicthooks"
import { useLuaCall, useLuaCallOnce } from '../../hooks'
import { useSelector } from '../../redux/store'

type Color = [number, number, number, number]

type ArgInputProps = {
  api: Api,
  onChange: (value: any, index: number)=> void,
  onValidChange?: (value: boolean)=> void,
  onEnter?: ()=> void,
  editing?: number,
  onEdit?: (index: number)=> void,
  inputRef?: (input: HTMLInputElement | null)=> void,
}

// TODO: 实现快速聚焦, 通过点击参数值直接进入编辑模式

// TODO: 目前还没必要，但是以后应该要实现对hash输入的支持

export default function ArgInput(props: ArgInputProps) {
  const {api, onChange, onEnter, editing, onEdit, onValidChange} = props
  const {name, args} = api || {}

  // valid flag hook
  const numFlags = 
  (name === "SetBankAndPlayAnimation" ||
    name === "SetSymbolAddColour" ||
    name === "SetSymbolMultColour" ) ? 2 : 0
  const [valid, setFlagOnIndex] = useValidFlags(numFlags)

  useEffect(()=> {
    if (numFlags !== 0 && typeof onValidChange === "function")
      onValidChange(valid)
  }, [numFlags, valid])

  if (name === "SetBank")
    return <BankSetter value={args[0] as string /* <-- a temp assert */} onChange={(v: string)=> onChange([v], -1)} onValidChange={onValidChange}/>
  else if (name === "SetBuild" || name === "SetSkin")
    return <BuildSetter value={args[0]} onChange={(v: string)=> onChange([v], -1)} onValidChange={onValidChange}/>
  else if (name === "SetBankAndPlayAnimation")
    return <>
      <BankSetter value={args[0] as string} onChange={(v: string)=> onChange(v, 0)} onValidChange={v=> setFlagOnIndex(v, 0)}/>
      <AnimSetter currentBank={args[0] as string} name={name} value={args[1]} onChange={(v: string)=> onChange(v, 1)} onValidChange={v=> setFlagOnIndex(v, 1)}/>
    </>
  else if (name === "SetAddColour" || name === "SetMultColour"){
    return <ColorSetter value={args} onChange={(v: Color)=> onChange(v, -1)} onValidChange={onValidChange}/>
  }
  else if (name === "SetSymbolAddColour" || name === "SetSymbolMultColour"){
    return <>
      <SymbolSetter value={args[0] as string} onChange={(v: string)=> onChange(v, 0)} onValidChange={v=> setFlagOnIndex(v, 0)}/>
      <ColorSetter value={args.slice(1) as any} onChange={(v: Color)=> onChange([args[0], ...v], -1)} onValidChange={v=> setFlagOnIndex(v, 1)}/>
    </>
  }
  else if (name === "Show" || name === "Hide" || name === "ShowLayer" || name === "HideLayer") {
    return <LayerSetter value={args[0] as string} onChange={(v: string)=> onChange(v, 0)} onValidChange={onValidChange}/>
  }
  else if (name === "ShowSymbol" || name === "HideSymbol" || name === "ClearOverrideSymbol") {
    return <SymbolSetter value={args[0] as string} onChange={(v: string)=> onChange(v, 0)} onValidChange={onValidChange}/>
  }
  else if (name === "PlayAnimation" || name === "PushAnimation" || name === "SetPercent") {
    return <AnimSetter name={name} value={args[0]} onChange={(v: string)=> onChange(v, 0)} onValidChange={onValidChange}/>
    // TODO: 非标准警告 额外参数
  }
  else if (name === "OverrideSymbol" || name === "OverrideSkinSymbol") {
    return <OverrideSymbolSetter args={args as string[]} onChange={onChange} onValidChange={onValidChange}/>
  }
  else if (name === "AddOverrideBuild" || name === "ClearOverrideBuild") {
    return <BuildSetter value={args[0]} onChange={(v: string)=> onChange([v], -1)} onValidChange={onValidChange}/>
  }
  else if (name === "Pause" || name === "Resume") {
    return <IgnoredSetter/>
  }
  else if (name === "SetDeltaTimeMultiplier") {
    return <IgnoredSetter/>
  }
  return <>还没做：p</>
  // const [value, setValue] = useState<[number, number, number, number]>([0,0,0,0])
  // return <ColorSetter value={value} onChange={setValue}/>
}

const value2rgb = (value: number[]): string => {
  return "#" + value.map((v, index)=> {
    if (index < 3) {
      v = Math.min(Math.max(0, v), 1)* 255
      return v.toString(16).padStart(2, "0")
    }
  }).join("")
}

const rgb2value = (s: string): number[] => {
  s = s.replace("#", "")
  return ([0,1,2]).map(i=> parseInt(s.substring(i*2, i*2+2), 16) / 255)
}

type ValidChangeCb = (valid: boolean)=> void

type ColorSetterProps = {
  value: [number, number, number, number],
  onChange: (value: ColorSetterProps["value"])=> void,
  onValidChange?: ValidChangeCb,
}

function ColorSetter(props: ColorSetterProps) {
  const {value, onChange, onValidChange} = props
  const rgbCode = value2rgb(value)
  const alpha = value[3]

  const [invalidInputValue, setInvalidValue] = useState<string>(undefined)
  const invalid = typeof invalidInputValue === "string"

  useEffect(()=> {
    if (typeof onValidChange === "function")
      onValidChange(!invalid) 
  }, [onValidChange, invalid])

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>)=> {
    onChange([...rgb2value(e.target.value), value[3]] as ColorSetterProps["value"])
  }, [value])

  const setAlpha = useCallback((v: number)=> {
    onChange([value[0], value[1], value[2], v])
  }, [value])

  const setAlphaFromBar = useCallback((v: number)=> {
    setAlpha(v)
    setInvalidValue(undefined)
  }, [setAlpha])

  const setAlphaFromInput = useCallback((v: string)=> {
    // hold invalid input string, but don't change real value
    v = v.trim()
    const n = v ? Number(v) : NaN
    if (n === n) {
      if (n >= 0 && n <= 100) {
        setAlpha(n / 100)
        setInvalidValue(undefined)
      }
      else {
        setAlpha(Math.max(0, Math.min(n / 100, 1)))
        setInvalidValue(v)
      }
    }
    else {
      setInvalidValue(v)
    }
  }, [setAlpha])

  return (
    <>
      <div>
        <ArgType text="颜色" intent="success"/>
        <input className={style["color-picker"]} value={rgbCode} type="color" onChange={handleColorChange}/>
      </div>
      <div>
        <ArgType text="强度" intent={invalid ? "danger" : "success"} tooltip={invalid ? "输入0–100之间的数字" : undefined}/>
        <div className={style["slider-container"]}>
          <Slider
            min={0} max={1} 
            stepSize={0.01}
            value={alpha}
            onChange={setAlphaFromBar}
            labelValues={[]}
            labelRenderer={value=> Math.round(value*100) + "%"}
            />
        </div>
        <InputGroup 
          value={invalid ? invalidInputValue : Math.round(alpha*100) + ""}
          onChange={e=> setAlphaFromInput(e.target.value)}
          className={style["arg-input-number"]}
          spellCheck={false}
          intent={invalid ? "danger" : "none"}
          maxLength={5}
        />
      </div>
    </>
  )
}

function BankSetter(props: StringInputProps) {
  const predict = useBasicPredicter("bank", props.value)
  return <StringInput {...props} label="库名" predict={predict}/>
}

function BuildSetter(props: StringInputProps) {
  const predict = useBasicPredicter("build", props.value)
  return <StringInput {...props} label="材质" predict={predict}/>
}

function AnimSetter(props: { currentBank?: string, name: string, value: string, onChange: (animation: string)=> void, onValidChange?: ValidChangeCb}) {
  const {value, onValidChange} = props
  const animstate = useGlobalAnimState()
  const bank = props.currentBank !== undefined ? props.currentBank : animstate.getActualBank()
  // TODO: 也许可以改为获取这一个api的上一个有效bank, 但真的有必要吗？

  const payload = useMemo(()=> ({
    bank, animation: value
  }), [bank, value])
  const predict = useBasicPredicter("animation", payload,
    (match, query)=> match === query.animation)

  useEffect(()=> {
    if (typeof onValidChange === "function")
      onValidChange(predict.isvalid)
  }, [onValidChange, predict])

  return <>
    <StringInput value={value} label="动画" predict={predict} onChange={props.onChange}/>
  </>
}

function SymbolSetter(props: { value: string, onChange: (symbol: string)=> void, onValidChange?: ValidChangeCb }) {
  const {value, onChange, onValidChange} = props
  const animstate = useGlobalAnimState()
  const symbolList = useMemo(()=> {
    return [...animstate.symbolCollection.values()].filter(v=> typeof v === "string")
  }, [animstate.symbolCollection])
  const predict = useHashPredicter(value, symbolList)
  return <StringInput 
    label="符号" value={value} onChange={onChange} 
    predict={predict} errorStyle="symbol"
    onValidChange={onValidChange}/>
}

function LayerSetter(props: { value: string, onChange: (layer: string)=> void, onValidChange?: ValidChangeCb }) {
  const {value, onChange, onValidChange} = props
  const animstate = useGlobalAnimState()
  const layerList = useMemo(()=> {
    return [...animstate.layerCollection.values()].filter(v=> typeof v === "string")
  }, [animstate.layerCollection])
  const predict = useHashPredicter(value, layerList)
  return <StringInput label="图层" value={value} onChange={onChange} predict={predict} errorStyle="symbol" onValidChange={onValidChange}/>
}

function OverrideSymbolSetter(props: { args: string[], onChange: (value: string, index: number)=> void, onValidChange?: ValidChangeCb }){
  const {args, onChange, onValidChange} = props
  const [symbolNames, setSymbolNames] = useState<string[]>([])
  const predict_ready = useSelector(({appstates})=> appstates.predict_init_flag)

  useLuaCallOnce<string>("load", (result)=> {
    if (result.startsWith("[")){
      const list: number[] = JSON.parse(result) // symbol list of this build
      const names = list.map(hash=> window.hash.get(hash))
        .filter(v=> typeof v === "string")
      setSymbolNames(names)
    }
    else {
      setSymbolNames([])
    }
  }, {type: "build", get_symbol_list: true, build: args[1]}, [args[1], predict_ready], [predict_ready])

  const predict = useHashPredicter(args[2], symbolNames)

  const [valid, setFlagOnIndex] = useValidFlags(3)
  useEffect(()=> {
    if (typeof onValidChange === "function") {
      onValidChange(valid)
    }
  }, [valid, onValidChange])

  return <>
    <SymbolSetter value={args[0]} onChange={v=> onChange(v, 0)} onValidChange={v=> setFlagOnIndex(v, 0)}/>
    <BuildSetter value={args[1]} onChange={v=> onChange(v, 1)} onValidChange={v=> setFlagOnIndex(v, 1)}/>
    <StringInput label="符号" value={args[2]} onChange={v=> onChange(v, 2)} predict={predict} onValidChange={v=> setFlagOnIndex(v, 2)}/>
  </>
}

type StringInputProps = {
  label?: string,
  value: string, // TODO: support number type (bankhash)
  onChange?: (value: string)=> void,
  onValidChange?: ValidChangeCb,
  predict?: ReturnType<typeof useBasicPredicter>,
  errorStyle?: "symbol"
}

function StringInput(props: StringInputProps) {
  const {label, value, onChange = console.log, predict = { hasPredicted: false } as any} = props
  // predictor values
  const {hasPredicted, isvalid, bestMatch} = predict
  const getHint = usePredicterFormatter(props.errorStyle || "default")
  const showError = hasPredicted && !isvalid
  const errorIntent = props.errorStyle === "symbol" ? "warning" : "danger"

  const onValidChange = props.onValidChange
  useEffect(()=> {
    if (typeof onValidChange === "function")
      onValidChange(isvalid)
  }, [onValidChange, isvalid])

  return (
    <>
      <div>
        <ArgType
          text={label} 
          intent={!hasPredicted ? "none" : showError ? errorIntent : "success"}
          tooltip={showError ? getHint({value, bestMatch}) : undefined }
          onClick={bestMatch ? ()=> onChange(bestMatch) : undefined}/>
        <InputGroup
          value={value}
          onChange={e=> onChange(e.target.value)}
          spellCheck={false}
          autoComplete={"none"}
          className={style["arg-input-string"]}/>
      </div>
    </>
  )
}

function ArgType(props: {text: string, tooltip?: JSX.Element | string, intent?: Intent, onClick?: any}) {
  const {tooltip, intent = "none"} = props
  const cursorStyle = (intent === "none" || intent === "success") ? "default" : "pointer"
  return (
    <div style={{display: "inline-block", minWidth: 30, cursor: cursorStyle}}>
      <Tooltip2 
        disabled={tooltip === undefined} 
        content={<span style={{whiteSpace: "pre-wrap"}}>{tooltip}</span>} 
        intent={intent} 
        placement="bottom-start">
        <Tag intent={intent} minimal onClick={props.onClick}>
          {props.text}
        </Tag>
      </Tooltip2>
    </div>
  )
}

function IgnoredSetter() {
  return (
    <div>
      这个还木有写
    </div>
  )
}