import React from 'react'
import { Icon } from '@blueprintjs/core'
import { byte2facing } from '../../facing'
import { FACING_UP, FACING_DOWN, FACING_LEFT, FACING_RIGHT,
  FACING_DOWNLEFT, FACING_DOWNRIGHT, FACING_UPLEFT, FACING_UPRIGHT,
  FACING_ALL, FACING_SIDE} from '../../facing'

const ICON_NAME = {
  [FACING_UP]: "arrow-up",
  [FACING_DOWN]: "arrow-down",
  [FACING_SIDE]: "arrows-horizontal",
}

export default function FacingIcon({facing}) {
  if (ICON_NAME[facing]) {
    return <div>
      <Icon icon={ICON_NAME[facing]}/>
    </div>
  }
  let s = byte2facing(facing)
  return <div>
    {s}
  </div>
}
