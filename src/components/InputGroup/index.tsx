import React, { RefObject, useCallback, useRef, useState } from 'react'
import { InputGroup as BpInputGroup } from '@blueprintjs/core'
import type { InputGroupProps2 } from '@blueprintjs/core'

/** input widget with better Chinese typing behavior */
export default function InputGroup(props: Omit<InputGroupProps2, "value" | "onChange">
  & {onChange2?: (query: string)=> void}) {
  const isComposing = useRef(false)
  const [query, setQuery] = useState("")
  const {onChange2} = props
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>)=> {
    setQuery(e.target.value)
    requestAnimationFrame(()=> {
      // delay one frame to ensure that `onCompositionEnd` is triggered
      if (!isComposing.current) {
        onChange2?.(e.target.value)
      }
    })
  }, [onChange2]
)
  return (
    <BpInputGroup
      autoComplete="off"
      spellCheck={false}
      {...props}
      value={query}
      onChange={onChange}
      onCompositionStart={()=> isComposing.current = true}
      onCompositionEnd={()=> isComposing.current = false}
    />
  )
}
