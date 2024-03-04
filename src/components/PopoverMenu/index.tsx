import { Menu, MenuItem, MenuItemProps } from '@blueprintjs/core'
import { Popover2, Popover2Props } from '@blueprintjs/popover2'
import React, { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import style from './index.module.css'

type PopoverMenuProps = {
  menu: Array<({
    key: string,
    text: string,
    /** setting direct url for a menu item 
     * makes it trigger instantly when user pressing ctrl/cmd and left click */
    directURL?: string,
  } & MenuItemProps)>,
  children: JSX.Element | string,
} & Pick<Popover2Props, "placement">

export default function PopoverMenu(props: PopoverMenuProps) {
  const {placement, menu} = props
  const nagivate = useNavigate()
  const directURL = useMemo(()=> {
    for (let v of menu) {
      if (typeof v.directURL === "string")
        return v.directURL
    }
  }, [menu])
  const [open, setOpen] = useState(false)

  return (
    <Popover2 minimal isOpen={open} {...{placement}}
      onInteraction={open=> {
        if (open && directURL && window.keystate["ctrl"])
          nagivate(directURL)
        else
          setOpen(open)
        }
      }
      // onOpening={()=> {
      //   if (window.keystate["ctrl"] && directURL)
      //     nagivate(directURL)
      // }}
      content={<Menu>
      {
        menu.map(v=> 
          <MenuItem 
            key={v.key}
            onClick={v.directURL ? ()=> nagivate(v.directURL) : undefined}
            {...v}/>)
      }
    </Menu>}>
      <span className={style["link"]}>
        {
          props.children
        }
      </span>
    </Popover2>
  )
}
