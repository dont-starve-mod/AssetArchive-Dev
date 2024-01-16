import React, { CSSProperties } from 'react'

type MatchTextProps = {
  text: string,
  match?: {start: number, length: number}[],
  style?: CSSProperties,
  markClassName?: string,
}

/** highlight meilisearch result matchesPosition */
export default function MatchText(props: MatchTextProps){
  let {
    text, 
    match, 
    style = {fontWeight: 500},
    markClassName = "highlight-color"
  } = props

  if (match === undefined) {
    return <span>{text}</span>
  }

  const result: JSX.Element[] = []
  let index = 0
  match.forEach(({start, length}, i)=> {
    let end = start + length
    if (index < start){
      result.push(
      <span key={`0-${i}`}>{text.substring(index, start)}</span>)
    }
    result.push(
      <span key={`1-${i}`} style={style} className={markClassName}>
        {text.substring(start, end)}
      </span>
    )
    index = end
  })
  result.push(<span key={"fin"}>{text.substring(index)}</span>)

  return (
    <>
      { result }
    </>
  )
}
