import React from 'react'
import { useNavigate } from 'react-router-dom'
import MatchText from '../../components/MatchText'
import Preview from '../../components/Preview'
import { H3 } from '@blueprintjs/core'
import style from "./index.module.css"
import { Hit, SearchParams } from 'meilisearch'
import { AllAssetTypes } from '../../searchengine'

const PREIVEW_SIZE = { width: 50, height: 50 }
const MARK_STYLE: React.CSSProperties = { fontWeight: 800 }

type Result = Hit & AllAssetTypes

export function AccessableItem(props: Result){
  const {type, id, plain_desc} = props
  const match = props._matchesPosition || {}
  const navigate = useNavigate()
  return (
    <div 
      className={style["search-item-box"]}
      onClick={()=> {
        // props.onClickItem()
        // TODO: 词条和asset的区别
        navigate("/asset?id=" + encodeURIComponent(id))
      }}>
      <div className={style["left"]}>
        <H3>
          {
            (type === "animzip" || type === "animdyn") ? 
              <MatchText text={props.file} match={match["file"]} style={MARK_STYLE}/> :
            type === "xml" ? 
              <MatchText text={props.file} match={match["file"]} style={MARK_STYLE}/> :
            type === "tex" ?
              <MatchText text={props.tex} match={match["tex"]} style={MARK_STYLE}/> :
            // type === "tex_no_ref" && props._is_cc ?
              
            type === "tex_no_ref" ?
              <MatchText text={props.file} match={match["file"]} style={MARK_STYLE}/> :
            type === "shader" ?
              <MatchText text={props.file} match={match["file"]} style={MARK_STYLE}/> :
            type === "fmodevent" ? 
              <MatchText text={props.path} match={match["path"]} style={MARK_STYLE}/> :
            type === "fmodproject" ?
              <MatchText text={props.file} match={match["file"]} style={MARK_STYLE}/> :
            <></>
          }
        </H3>
        <p>
          {/* {
            desc &&
            <AssetDescFormatter.PlainText desc={plain_desc}/>
          } */}
          {plain_desc}
        </p>
      </div>
      <div className={style["preview-box"] + " bp4-elevation-1"} style={{...PREIVEW_SIZE}}>
        {
          type === "tex" ? 
            <Preview.Image {...props} {...PREIVEW_SIZE}/> :
          type === "xml" ? 
            <Preview.XmlMap {...props} {...PREIVEW_SIZE}/> :
          type === "animzip" || type === "animdyn" ? 
            <Preview.Zip {...props} {...PREIVEW_SIZE}/> :
          type === "tex_no_ref" && props._is_cc === true ?
            <Preview.CC {...props} {...PREIVEW_SIZE} cc={props.file} 
            sourceType={"image"}
            xml={"images/bg_loading_loading_farming.xml"} 
            tex={"loading_farming.tex"}/> :
          type === "tex_no_ref" ? 
            <Preview.Texture {...props} {...PREIVEW_SIZE}/> :
          type === "fmodevent" ? 
            <Preview.Sfx {...props} {...PREIVEW_SIZE}/> :
          type === "shader" ? 
            <Preview.SimpleIcon icon="code"/> :
          type === "fmodproject" ?
            <Preview.SimpleIcon icon="box"/> :
          <></>
        }
      </div>
    </div>
  )
}