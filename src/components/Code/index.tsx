import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { tomorrowNight } from 'react-syntax-highlighter/dist/esm/styles/hljs'

type CodeProps = {
  src: string,
  language: "lua" | "glsl"
}

export default function Code(props: CodeProps) {
  return (
    <SyntaxHighlighter
      showLineNumbers 
      style={tomorrowNight}
      customStyle={{borderRadius: 2}}
      language={props.language}>
      {
        props.src
      }
    </SyntaxHighlighter>
    
  )
}