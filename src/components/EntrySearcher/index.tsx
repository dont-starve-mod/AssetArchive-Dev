import { Button, Callout, Card, H5, InputGroup, Tag, TagProps } from '@blueprintjs/core'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocalStorage, useOS } from '../../hooks'
import { useSelector } from '../../redux/store'

type Filter = {
  key: string,
  label: string,
  type: "major" | "character" | "food" | "category" | "property",
}

type EntryFilterProps = {

}

const useClassifyEntryFilters = (filters: [string, string][])=> {
  // check labels
  // let labels = new Set<string>()
  // for (let v of filters) {
  //   if (labels.has(v[1])) {
  //     console.error("duplicated label", v[1])
  //   }
  //   labels.add(v[1])
  // }

  type FilterList = (Omit<Filter, "type"> & {sort: number})[]

  return useMemo(()=> {
    const major = [] as FilterList
    const character = [] as FilterList
    const food = [] as FilterList
    const category = [] as FilterList // what it is
    const property = [] as FilterList // what it does
    
    const keyToLabel = {} as {[key: string]: string}
    filters.forEach((v)=> {
      const [key, label] = v
      keyToLabel[key] = label
      if (key.startsWith("type.")){
        major.push({key, label, sort: 0})
      }
      else if(key.startsWith("crafted_by.")) {
        character.push({key, label, sort: 0})
      }
      else if (key.startsWith("food.")) {
        food.push({key, label, sort: 0})
      }
      else if (key.startsWith("subcat.") || key.startsWith("insulator.")) {
        category.push({key, label, sort: key.startsWith("insulator.") ? 1 : 0})
      }
      else if (key.startsWith("workable.")) {
        property.push({key, label, sort: -1})
      }
      else if (key.endsWith("+") || key.endsWith("-")) {
        if (key.indexOf("dapperness") !== -1) {
          property.push({key, label, sort: -2})
        }
        else {
          property.push({key, label, sort: -3})
        }
      }
      else if (key === "armor" || key === "weapon" || key === "tool") {
        return // ignore, use subcat
      }
      else if (key.endsWith("_aligned")) {
        category.push({key, label, sort: 1})
      }
      else {
        property.push({key, label, sort: 0}) // as default
      }
    })

    let result = { major, character, food, category, property }
    Object.entries(result).forEach(([type, v])=> {
      let temp = v.toSorted((a, b)=> {
        if (a.sort !== b.sort)
          return a.sort - b.sort
        else
          return a.key.localeCompare(b.key)
      })
      // @ts-ignore
      v.splice(0, v.length, ...temp.map(({key, label})=> 
        ({ key, label, type })
      ))
    })

    return {
      ...result, keyToLabel
    }

  }, [filters])
}

function EntryFilter(props: EntryFilterProps) {
  const all_tag_names = useSelector(({appstates})=> appstates.entry_tags)
  const all_tag_classify = useClassifyEntryFilters(all_tag_names as any)
  const names = ["major", "category", "food", "property", "character"]
  const [unfold, setUnfold] = useLocalStorage("entry_filter_unfold")
  const [selected, setSelected] = useLocalStorage("entry_filter_selected")
  const {isMacOS} = useOS()
  const multSelectKeyDown = useRef<boolean>(false)

  useEffect(()=> {
    const key = isMacOS ? "Meta" : "Control"
    const onKeyDown = (e: KeyboardEvent)=> {
      if (e.key === key) {
        multSelectKeyDown.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent)=> {
      if (e.key === key) {
        multSelectKeyDown.current = false
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return ()=> {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [isMacOS])

  const onClickTag = useCallback((key: string)=> {
    if (selected[key])
      setSelected({...selected, [key]: undefined})
    else {
      if (multSelectKeyDown.current) {
        setSelected({...selected, [key]: true})
      }
      else {
        const newValue = {...selected}
        Object.entries(all_tag_classify).forEach(([type, tags])=> {
          if (Array.isArray(tags) && tags.some(v=> v.key === key)) {
            tags.forEach(v=> newValue[v.key] = undefined)
          }
        })
        newValue[key] = true
        setSelected(newValue)
      }
    }
  }, [selected, setSelected, all_tag_classify])

  return (
    // <div className="flex flex-row flex-wrap justify-between" style={{width: "100%"}}>
    <div>
      {
        names.map(name=> {
          const tag = all_tag_classify[name] as Filter[]
          const show = unfold[name]
          // const hasSelected = tag.some(v=> selected[v[0]])
          return <Card className="p-1 mb-1">
            <div className="mb-1 border-b-2 border-b-gray-400 pr-7 relative">
              <div className="absolute right-0 top-0" style={{padding: 2}}>
                {
                  tag.length > 10 &&
                  <Button icon={show ? "cross" : "more"} minimal small className="scale-75"
                    onClick={()=> setUnfold({...unfold, [name]: !show})}></Button>
                }
              </div>
              <div className={`flex flex-row justify-between ${
                show ? "flex-wrap" : "flex-nowrap overflow-auto"
              }`}>
                {
                  tag.map(({key, label})=> 
                  <FilterTag key={key} filterKey={key} onClick={()=> onClickTag(key)}>
                    {label}
                  </FilterTag>)
                }
                <div className="flex-1"></div>
              </div>
            </div>
          </Card>
        })
      }
      </div>
  )
}


type EntrySearcherProps = {

}





export default function EntrySearcher(props: EntrySearcherProps) {
  const [selected, setSelected] = useLocalStorage("entry_filter_selected")
  const numSelected = Object.entries(selected).filter(v=> v[1] === true).length
  const all_tag_names = useSelector(({appstates})=> appstates.entry_tags)
  const {keyToLabel} = useClassifyEntryFilters(all_tag_names as any)
  return (
    <div>
      {/* <H3 className="mt-4">标题</H3> */}
      <Callout className="mt-4 pb-3">
        <div className="flex mb-2">
          <InputGroup
            leftIcon="filter"
            placeholder="筛选"
            className="w-40 flex-0"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="overflow-auto flex-1">
            {
              Object.entries(selected).map(([key, value])=> 
                value && <Tag minimal className="m-1" 
                  onRemove={()=> setSelected({...selected, [key]: undefined})}>
                    {keyToLabel[key]}
                  </Tag>)
            }
          </div>
          <div className="ml-auto flex-0">
            <Button onClick={()=> setSelected({})}>
              清空
              <Tag minimal className="ml-1">{numSelected}</Tag>
            </Button>
          </div>
        </div>
        <EntryFilter/>
      </Callout>
      <div>
        <H5 className="mt-6">筛选结果</H5>
      </div>
      
    </div>
  )
}

const FilterTag = (props: TagProps & {filterKey: string})=> {
  const {filterKey} = props
  const [selected, setSelected] = useLocalStorage("entry_filter_selected")
  return <Tag {...props} 
    minimal={selected[filterKey] ? false : true}
    interactive 
    className="m-1 shrink-0"
    intent={selected[filterKey] ? "primary" : "none"}
  />
}