import React, { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { InputGroup as BpInputGroup } from '@blueprintjs/core'
import type { InputGroupProps2 } from '@blueprintjs/core'
import { isSearchable } from '../../global_meilisearch'

/** input widget with better Chinese typing behavior */
export default function InputGroup(props: Omit<InputGroupProps2, "value" | "onChange">
  & {onChange2?: (query: string)=> void, search?: boolean}) {
  const isComposing = useRef(false)
  const [query, setQuery] = useState("")
  const {onChange2, search} = props
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>)=> {
    setQuery(e.target.value)
    requestAnimationFrame(()=> {
      // delay one frame to ensure that `onCompositionEnd` is triggered
      if (!isComposing.current) {
        onChange2?.(e.target.value)
      }
    })
  }, [onChange2])

  // wait for search engine indexing
  const [flag, setFlag] = useState<number>(()=> search && !isSearchable() ? 1 : -1)
  const loading = flag > 0
  useEffect(()=> {
    if (loading){
      let timer = setInterval(()=> {
        if (isSearchable())
          setFlag(-1)
        else
          setFlag(v=> v + 1)
      }, 200)
      return ()=> { clearInterval(timer) }
    }
  }, [loading])

  const {className = ""} = props

  return (
    <BpInputGroup
      autoComplete="off"
      spellCheck={false}
      {...props}
      className={className + (loading ? " bp4-skeleton" : "")}
      value={query}
      onChange={onChange}
      disabled={loading}
      onCompositionStart={()=> isComposing.current = true}
      onCompositionEnd={()=> isComposing.current = false}
    />
  )
}
