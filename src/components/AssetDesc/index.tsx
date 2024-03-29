import React, { useMemo } from 'react'
import type { RichText, AssetDescLine } from '../../assetdesc'
import style from './index.module.css'
import { useNavigate } from 'react-router-dom'

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
export type AssetTag = "#music" | "#ambient_sound" | "#character_voice" | "#fx" | "#main_screen"

function TagLink(props: {tag: string}) {
  const {tag} = props
  const link = useMemo(()=> {
    switch (tag as AssetTag) {
      // TODO: auto generate for static.tsx
      case "#music": return "STATIC@multi_sound.Music"
      case "#ambient_sound": return "STATIC@multi_sound.AmbientSound"
      case "#character_voice": return "STATIC@multi_sound.CharacterVoice"
      case "#fx": return "STATIC@multi_entry.Fx"
      default: return ""
    }
  }, [tag])
  const navigate = useNavigate()
  return (
    <a onClick={()=> navigate("/asset?id="+link)}>{tag}</a>
  )
}

export default function AssetDesc(props: AssetDescProps) {
  const asset = window.assets_map[props.id || ""]
  const desc = asset && asset.desc
  const isEntry = asset && asset.type === "entry"

  return (
    <div className={style["box"]}>
      {
        Array.isArray(desc) && desc.length > 0 ? desc.map(v=> {
          if (typeof v === "string") {
            return !v.startsWith("#") ?
              <p style={{wordWrap: "break-word", whiteSpace: "pre-line"}}>
                {addPunc(v)}
              </p> :
              <p>
                <TagLink tag={v}/>
              </p>
          }
          else
            return <RichTextFormatter desc={v as RichText}/>
        }) :
        <p style={{color: "#999"}}>
          {
            isEntry ? "这个词条还没有任何描述。" :
            "这个资源还没有任何描述。"
          }
        </p>
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