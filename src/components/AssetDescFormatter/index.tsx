import React, { useMemo } from 'react'
import { AssetDesc, RichText } from '../../assetdesc'

function RichTextToPlain(props: {text: RichText}) {
  const plain = useMemo(()=> {
    return props.text.value.map(({text, anydata})=> {
      if (text) return text
      if (anydata) {


        return ""
      }
    }).join("")
  }, [props.text.value])
  return <span>{plain}</span>
}

function PlainText(props: { description: AssetDesc }) {
  const {description} = props
  return (
    <>
    {
      description.map((text, i)=> 
        <>
        {
          text.type === "plain" ? <span key={i}>{text.value}</span> : 
          <RichTextToPlain key={i} text={text}/>
        }
        &nbsp;
        </>)
    }
    </>
  )
}

export default {
  PlainText
}