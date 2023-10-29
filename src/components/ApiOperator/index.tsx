import React from 'react'
import style from './index.module.css'
import { Button, H5, H6 } from '@blueprintjs/core'

const buttonStyle: React.CSSProperties = {
  margin: "4px 0",
  display: "block",
  minWidth: 180,
}
export default function ApiOperator() {
  return (
    <div className={style["box"]}>
      <H5>删除/禁用指令</H5>
      <p>右键点击名字可删除或禁用一条指令。</p>
      <hr/>
      <H6>批量操作</H6>
      <Button icon="eye-off" style={buttonStyle}>禁用所有的错误指令</Button>
      <Button icon="eye-off" style={buttonStyle}>禁用所有的调色指令</Button>
      <Button icon="eye-open" style={buttonStyle}>启用所有的调色指令</Button>
      <Button icon="eye-open" style={buttonStyle}>启用所有的指令</Button>
      <Button icon="trash" style={buttonStyle} intent="danger">删除所有的错误指令</Button>
      
    </div>
  )
}
