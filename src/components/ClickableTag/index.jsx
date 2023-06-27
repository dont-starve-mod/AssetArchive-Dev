import { Icon, Tag } from "@blueprintjs/core"
import { ASSET_TYPE } from "../../strings"

export default function ClickableTag({type, term}) {
  return <div style={{display: "inline-block", verticalAlign: "middle"}}>
    <div style={{display: "flex", justifyContent: "center"}}>
      <Tag interactive={true} onClick={()=> window.alert("TODO:实现")}>
        {type && ASSET_TYPE[type]}
        {term !== undefined && term}
      </Tag>
    </div>
  </div>
}