import { Button, Radio, RadioGroup } from '@blueprintjs/core'
import { Popover2, Popover2Props } from '@blueprintjs/popover2'
import React from 'react'

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
      content={<div className="sort-popover">
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
