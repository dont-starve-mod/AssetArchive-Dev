import { Icon, Tag } from "@blueprintjs/core"
import { ASSET_TYPE } from "../../strings"
import { AllAssetTypes } from "../../datatype"
import React from "react"

interface IProps {
  type?: AllAssetTypes["type"],
  term?: string,
}

export default function ClickableTag(props: IProps) {
  const {type, term} = props
  return <div style={{display: "inline-block", verticalAlign: "middle"}}>
    <div style={{display: "flex", justifyContent: "center"}}>
      <Tag interactive={true} onClick={()=> window.alert("TODO:实现")}>
        {type && ASSET_TYPE[type]}
        {term}
      </Tag>
    </div>
  </div>
}