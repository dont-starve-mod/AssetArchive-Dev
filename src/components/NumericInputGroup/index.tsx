import { InputGroup, InputGroupProps2 } from '@blueprintjs/core'
import React, { useCallback, useEffect, useState } from 'react'

interface IProps extends InputGroupProps2 {
  min: number,
  max: number,
  /** default value when input string is not a valid number */
  fallback?: number,
  numericValue: number,
  onChangeNumericValue: (v: number)=> void,
}

export default function NumericInputGroup(props: IProps) {
  const [invalidInputValue, setInvalidValue] = useState<string>(undefined)
  const invalid = typeof invalidInputValue === "string"
  const {numericValue, onChangeNumericValue} = props
  const {min, max, fallback = NaN} = props

  const onChange = useCallback((v: string)=> {
    // hold invalid input string, but don't change real value
    v = v.trim()
    const n = v ? Number(v) : NaN
    if (n === n) {
      if (n >= min && n <= max) {
        onChangeNumericValue(n)
        setInvalidValue(undefined)
      }
      else {
        onChangeNumericValue(fallback)
        setInvalidValue(v)
      }
    }
    else {
      onChangeNumericValue(fallback)
      setInvalidValue(v)
    }
  }, [onChangeNumericValue])

  useEffect(()=> {
    if (numericValue === numericValue) {
      setInvalidValue(undefined)
    }
  }, [numericValue])

  return (
    <InputGroup 
      spellCheck={false}
      autoComplete="none"
      value={invalid ? invalidInputValue : numericValue + ""}
      onChange={e=> onChange(e.currentTarget.value)}
      {...props}/>
  )
}
