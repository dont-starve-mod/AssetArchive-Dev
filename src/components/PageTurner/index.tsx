import { Button } from '@blueprintjs/core'
import React from 'react'

type PageTurnerProps = {
  page: number,
  totalPage: number,
  next: ()=> void,
  prev: ()=> void,
  first: ()=> void,
  last: ()=> void,
}

export default function PageTurner(props: PageTurnerProps) {
  const {page, totalPage} = props
  return (
    <div>
      <Button icon="step-backward" disabled={page <= 0} onClick={props.first}/>
      <div style={{display: "inline-block", width: 10}}/>
      <Button icon="arrow-left" disabled={page <= 0} onClick={props.prev}>
        上一页
      </Button>
      <div style={{display: "inline-block", padding: 5}}>
        {page + 1}/{totalPage}
      </div>
      <Button icon="arrow-right" disabled={page >= totalPage - 1} onClick={props.next}>
        下一页
      </Button>
    </div>
  )
}
