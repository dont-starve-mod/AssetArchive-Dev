import React, { useCallback, useContext, useMemo, useState } from 'react'
import { Button, H6, InputGroup, Intent, Slider, Tag } from '@blueprintjs/core'
import style from './index.module.css'
import { Tooltip2 } from '@blueprintjs/popover2'
import { AnimState, Api, BasicApi } from '../AnimCore_Canvas/animstate'
import animstateContext from '../../pages/AnimRendererPage/globalanimstate'
import { useBasicPredicter, useGlobalAnimState, usePredicterFormatter } from "./util"
import { FuseResult } from '../../searchengine'

// export function ArgInput_(props: IProps) {
//   const {value, onChange} = props
//   const handleKeyDown = useCallback((e: React.KeyboardEvent)=> {
//     if (e.key === "Enter") {
//       props.onEnter?.()
//     }
//   }, [])  
//   return (
//     <div style={{position: "relative", display: "flex"}}>
//       <span className={style["arg-type"]}>参数</span>
//       <InputGroup 
//         inputRef={props.inputRef}
//         spellCheck={false}
//         autoComplete={"none"}
//         className={style["arg-input"]}
//         value={value}
//         onFocus={props.onFocus}
//         onChange={(e)=> onChange(e.target.value)}
//         onKeyDown={handleKeyDown}
//       />
//       <ColorSetter/>
//     </div>
//   )
// }

interface IProps {
  api: Api,
  onChange: (value: any, index: number)=> void,
  onEnter?: ()=> void,
  editing?: number,
  onEdit?: (index: number)=> void,
  inputRef?: (input: HTMLInputElement | null)=> void,
}

// TODO: 实现快速聚焦

export default function ArgInput(props: IProps) {
  const {api, onChange, onEnter, editing, onEdit} = props
  const {name, args} = api || {}
  if (name === "SetAddColour" || name === "SetMultColour"){
    return <ColorSetter value={args} onChangeColor={(v)=> onChange(v, -1)} />
  }
  else if (name === "SetBank")
    return <BankSetter value={args[0] as string /* <-- a temp assert */} onChange={(v: string)=> onChange([v], -1)}/>
  else if (name === "SetBuild" || name === "SetSkin")
    return <BuildSetter value={args[0]} onChange={(v: string)=> onChange([v], -1)}/>
  else if (name === "SetBankAndPlayAnimation")
    return <>
      <BankSetter value={args[0] as string} onChange={(v: string)=> onChange(v, 0)}/>
      <AnimSetter name={name} args={[args[1]]} onChange={(v: any[])=> console.log(v)}/>
    </>
  else if (name === "SetSymbolAddColour" || name === "SetSymbolMultColour"){
    return <>
      <SymbolSetter/>
      <ColorSetter value={args.slice(1) as any} onChangeColor={(v)=> onChange()}/>
    </>
  }
  else if (name === "Show" || name === "Hide" || name === "ShowLayer" || name === "HideLayer") {
    return <LayerSetter/>
  }
  else if (name === "ShowSymbol" || name === "HideSymbol") {
    return <SymbolSetter/>
  }
  else if (name === "PlayAnimation" || name === "PushAnimation" || name === "SetPercent") {
    return <AnimSetter name={name} args={args} />
  }
  else if (name === "OverrideSymbol" || name === "OverrideSkinSymbol") {
    return <OverrideSymbolSetter/>
  }
  else if (name === "AddOverrideBuild" || name === "ClearOverrideBuild") {
    return <BuildSetter value={args[0]} onChange={(v: string)=> onChange([v], -1)}/>
  }
  else if (name === "Pause" || name === "Resume") {
    return <IgnoredSetter/>
  }
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

interface ColorSetterProps {
  value: [number, number, number, number],
  onChangeColor: (value: ColorSetterProps["value"])=> void,
}

function ColorSetter(props: ColorSetterProps) {
  const {value, onChangeColor} = props
  const rgbCode = value2rgb(value)
  const alpha = value[3]

  const [invalidInputValue, setInvalidValue] = useState<string>(undefined)
  const invalid = typeof invalidInputValue === "string"

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>)=> {
    onChangeColor([...rgb2value(e.target.value), value[3]] as ColorSetterProps["value"])
  }, [value])

  const setAlpha = useCallback((v: number)=> {
    onChangeColor([value[0], value[1], value[2], v])
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
        <ArgType text="颜色" />
        <input className={style["color-picker"]} value={rgbCode} type="color" onChange={handleColorChange}/>
      </div>
      <div>
        <ArgType text="强度" intent={invalid ? "danger" : "none"} tooltip={invalid && "输入0–100之间的数字"}/>
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
          maxLength={5}
        />
        {/* {
          invalid &&
          <Tooltip2 content={"输入0–100之间的数字"}>
            <Button icon="error" minimal small intent="danger" style={{marginLeft: 5}}/>
          </Tooltip2>
        } */}
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

function AnimSetter(props: { name: string, args: any[], onChange: Function}) {
  const {args} = props
  const animstate = useGlobalAnimState()
  const bank = animstate.getActualBank()
  // TODO: 也许可以改为获取这一个api的上一个有效bank？但真的有必要吗？
  // TODO: 检查这里对象地址的diff算法，如有必要需要使用useMemo！！！！
  const payload = useMemo(()=> ({
    bank, animation: args[0]
  }), [bank, args[0]])
  const predict = useBasicPredicter("animation", payload,
    (match, query)=> match === query.animation)
  console.log(predict)
  return <>
    <StringInput value={args[0]} label="动画" predict={predict}/>
  </>
}

function SymbolSetter(props: StringInputProps & { warnIfNotExist?: boolean }) {
  return <StringInput {...props} on label="符号"/>
}

// function OverrideSymbolSetter(props: )

type StringInputProps = {
  label?: string,
  value: string, // TODO: support number type (bankhash)
  onChange?: (value: string)=> void,
  predict?: ReturnType<typeof useBasicPredicter>,
}

function StringInput(props: StringInputProps) {
  const {label, value, onChange = console.log} = props
  // predictor
  const {hasPredicted, isvalid, bestMatch} = props.predict
  const getHint = usePredicterFormatter("default")
  const showError = hasPredicted && !isvalid
  return (
    <>
      <div>
        <ArgType
          text={label} 
          intent={!hasPredicted ? "none" : showError ? "danger" : "success"}
          tooltip={showError ? getHint({bestMatch}) : undefined }
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
  return (
    <div style={{display: "inline-block", minWidth: 30}}>
      <Tooltip2 disabled={tooltip === undefined} content={tooltip} intent={intent} placement="top-start">
        <Tag intent={intent} minimal interactive onClick={props.onClick}>
          {props.text}
        </Tag>
      </Tooltip2>
    </div>
  )
}