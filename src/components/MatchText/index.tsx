import React, { CSSProperties } from 'react'

interface IProps {
  text: string,
  match?: number[],
  markStyle?: CSSProperties,
  range?: [number, number],
}

export default function MatchText(props: IProps){
  const {text, match, markStyle = {color: "#6020d0", fontWeight: 500}, range = [-1, -1]} = props

  const [r1, r2] = range
  if (!match) {
    if (r2 > 0 && (r1+r2) < text.length){
      return <>{text.substring(0, r1+r2) + "..."}</>
    }
    else{
      return <>{text}</>
    }
  }

  const temp: Array<[string, boolean]> = []
  let index = 0
  match.forEach((i: number)=> {
    if (i > index){
      if (index === 0 && r1 > 0 && i - r1 > 0){
        temp.push(["..." + text.substring(i - r1, i), false])
      }
      else{
        temp.push([text.substring(index, i), false])
      }
    }
    temp.push([text[i], true])
    index = i + 1
  })
  if (r2 > 0 && text.length > index + r2){
    temp.push([text.substring(index, index + r2) + "...", false])
  }
  else{
    temp.push([text.substring(index), false])
  }

  return <>
  {
    temp.map(([str, highlight], i: number)=>
      highlight ? <span key={i} style={markStyle}>{str}</span> : str
    )
  }
  </>
}
