import { Button, Radio, RadioGroup } from '@blueprintjs/core'
import { Popover2, Popover2Props } from '@blueprintjs/popover2'
import React, { useCallback } from 'react'
import { FmodEvent } from '../../searchengine'
import { BankSort, FevSort } from '../../redux/reducers/localstorage'

type SortableFieldProps = {
  text: string,
  selectedValue: string,
  onChange: (event: React.FormEvent<HTMLInputElement>) => void,
  choices: Array<{visible?: boolean, label: string, value: string}>
} & Popover2Props

/** Title with a sort which can popover sort settings on click, useful in table th */
export default function SortableField(props: SortableFieldProps) {
  return (
    <Popover2 
      minimal 
      placement="right" 
      // targetTagName="div"
      {...props} 
      content={Array.isArray(props.choices) &&
      <div className="sort-popover">
        <RadioGroup selectedValue={props.selectedValue} onChange={props.onChange}>
          {
            props.choices.map(v=> 
              v.visible !== false && <Radio key={v.value} value={v.value} label={v.label}/>)
          }
        </RadioGroup>
      </div>}>
      <div style={{cursor: "pointer", display: "block"}}>
        {props.text}
        <Button minimal icon="sort"/>
      </div>
    </Popover2>
  )
}

function NoSort(props: {text: string}) {
  return (
    <div style={{cursor: "pointer", display: "block"}}>
      {props.text}
      <Button minimal icon="blank" disabled style={{cursor: "default"}}/>
    </div>
  )
}

SortableField.NoSort = NoSort

// public sorter fns


enum CategoryPrefix {
  SFX = "master/set_sfx/",
  MUSIC = "master/set_music/",
  AMB = "master/set_ambience/",
}

export function useSoundSorter(sort: FevSort[]) {
  return useCallback((a: FmodEvent, b: FmodEvent)=> {
    for (let s of sort) {
      let prefix = "" // test prefix for category
      let loopIs = Infinity // always place loop to bottom, unless sort by `len.loop`
      switch (s) {
        case "path.a-z":
        case "path.z-a":
          if (a.path !== b.path)
            return (a.path < b.path) === (s === "path.a-z") ? -1 : 1
        
        case "category.amb":
          prefix = prefix || CategoryPrefix.AMB
        case "category.music":
          prefix = prefix || CategoryPrefix.MUSIC
        case "category.sfx":
          prefix = prefix || CategoryPrefix.SFX
          const ac = a.category.startsWith(prefix)
          const bc = b.category.startsWith(prefix)
          if (ac !== bc)
            return ac ? -1 : 1
        case "len.loop":
        case "len.9-0":
          loopIs = -1
        case "len.0-9":
          const al = a.lengthms < 0 ? loopIs : a.lengthms
          const bl = b.lengthms < 0 ? loopIs : b.lengthms
          if (al !== bl)
            return (al < bl) === (s === "len.0-9" || s === "len.loop") ? -1 : 1

        case "no-param":
          const anp = a.param_list.length === 0
          const bnp = b.param_list.length === 0
          if (anp !== bnp)
            return anp ? -1 : 1
        
        case "project.a-z":
        case "project.z-a":
          if (a.project !== b.project)
            return (a.project < b.project) === (s === "project.a-z") ? -1 : 1
        default:
          // param-xxxxx
          const ap = Boolean(a.param_list.find(({name})=> `param-${name}` === s))
          const bp = Boolean(b.param_list.find(({name})=> `param-${name}` === s))
          if (ap !== bp)
            return ap ? -1 : 1
      }
    }
    return 0
  }, [sort])
}

export function useAnimationSorter(sort: BankSort[]) {
  return useCallback((a, b)=> {
    // check sort rule from start to end
    for (let s of sort) {
      switch (s) {
        case "name.a-z":
        case "name.z-a":
          if (a.name !== b.name)
            return (s === "name.a-z") === (a.name < b.name) ? -1 : 1
        case "path.a-z":
        case "path.z-a":
          if (a.assetpath !== b.assetpath)
            return (s === "path.a-z") === (a.assetpath < b.assetpath) ? -1: 1
        case "0-9":
        case "9-0":
          if (a.numframes !== b.numframes)
            return (s === "0-9") === (a.numframes < b.numframes) ? -1 : 1
        default:
          const a_top = s === `facing-${a.facing}`
          const b_top = s === `facing-${b.facing}`
          if (a_top !== b_top)
            return a_top ? -1 : 1
          else if (a.facing !== b.facing)
            return a.facing - b.facing
      }
    }
    return 0
  }, [sort])
}