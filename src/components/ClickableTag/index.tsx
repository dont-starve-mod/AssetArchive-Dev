import { Icon, Tag } from "@blueprintjs/core"
import { ASSET_TYPE } from "../../strings"
import { ArchiveItem } from "../../searchengine"
import React from "react"

interface IProps {
  type?: ArchiveItem["type"] & "cc",
  term?: string,
}

export default function ClickableTag(props: IProps) {
  const {type, term} = props
  return <div style={{display: "inline-block", verticalAlign: "middle", margin: "0 2px"}}>
    <div style={{display: "flex", justifyContent: "center"}}>
      <Tag interactive={true} onClick={()=> window.alert("TODO:实现")}>
        {type === "cc" && "颜色映射"}
        {type && ASSET_TYPE[type]}
        {term}
      </Tag>
    </div>
  </div>
}