import React from 'react'
import { byte2facing } from '../../facing'

export default function FacingString({facing}) {
  let s = byte2facing(facing)
  // TODO: tooltip for facing bytes
  return <div>
    {s}
  </div>
}
