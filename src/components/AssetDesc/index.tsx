import React from 'react'
import type { RichText, AssetDescLine } from '../../assetdesc'
import style from './index.module.css'

type AssetDescProps = {
  id: string,
  // desc: AssetDescLine[],
}

function addPunc(s: string) {
  if (![".", "。", "!", "！", "?", "？"].find(v=> s.endsWith(v))){
    s = s + "。" // TODO: Loc
  }
  return s
}

export default function AssetDesc(props: AssetDescProps) {
  const asset = window.assets_map[props.id || ""]
  const desc = asset && asset.desc

  return (
    <div className={style["box"]}>
      {
        Array.isArray(desc) && Boolean(desc) ? desc.map(v=> {
          if (typeof v === "string")
            return <p style={{wordWrap: "break-word", whiteSpace: "pre-line"}}>
              {addPunc(v)}
            </p>
          else
            return <RichTextFormatter desc={v as RichText}/>
        }) :
        <p style={{color: "#999"}}>这个资源还没有任何描述。</p>
      }
    </div>
  )
}

function RichTextFormatter(props: {desc: RichText}) {
  return (
    <p>
      {
        JSON.stringify(props.desc)
      }
    </p>
  )
}