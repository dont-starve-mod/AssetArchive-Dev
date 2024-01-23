import React, { CSSProperties } from 'react'

interface IProps {
  text: string,
  match?: [number, number][],
  markStyle?: CSSProperties,
  bestMatch?: false,
  numMismatchChars?: number,
}

// for Fuse.js

export default function MatchText(props: IProps){
  let {
    text, 
    match, 
    markStyle = {color: "#6020d0", fontWeight: 500}, 
    bestMatch,
    numMismatchChars = 1000
  } = props

  if (match === undefined) {
    return <span>{text}</span>
  }

  const result: JSX.Element[] = []
  let index = 0
  if (bestMatch !== false) {
    match = [...match].sort((a, b)=> -(a[1]-a[0])+(b[1]-b[0]))
    match.splice(1, match.length)
  }
  let matchGuard = [...match, [99999, 99999]]
  matchGuard.forEach(([start, end], i)=> {
    if (index < start){
      result.push(<span key={`0-${i}`}>{text.substring(index, start)}</span>)
    }
    result.push(<span key={`1-${i}`} style={markStyle}>{text.substring(start, end + 1)}</span>)
    index = end + 1
  })

  return (
    <>
      { result }
    </>
  )
  
}
