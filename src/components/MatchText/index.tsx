import React, { CSSProperties } from 'react'

interface IProps {
  text: string,
  match?: {start: number, length: number}[],
  markStyle?: CSSProperties,
}

/** highlight meilisearch result matchesPosition */
export default function MatchText(props: IProps){
  let {
    text, 
    match, 
    markStyle = {color: "#6020d0", fontWeight: 500}, 
  } = props

  if (match === undefined) {
    return <span>{text}</span>
  }

  const result: JSX.Element[] = []
  let index = 0
  match.forEach(({start, length}, i)=> {
    let end = start + length
    if (index < start){
      result.push(<span key={`0-${i}`}>{text.substring(index, start)}</span>)
    }
    result.push(<span key={`1-${i}`} style={markStyle}>{text.substring(start, end)}</span>)
    index = end
  })
  result.push(<span key={"fin"}>{text.substring(index)}</span>)

  return (
    <>
      { result }
    </>
  )
}
