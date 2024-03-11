import { Icon, Tag, TagProps } from "@blueprintjs/core"
import { ARCHIVE_TYPE_TITLE } from "../../strings"
import { ArchiveItem } from "../../searchengine"

type IProps = {
  type?: ArchiveItem["type"] | "cc",
  term?: string,
} & TagProps

export default function ClickableTag(props: IProps) {
  const {type, term} = props
  return <div style={{display: "inline-block", verticalAlign: "middle", margin: "0 2px"}}>
    <div style={{display: "flex", justifyContent: "center"}}>
      {/* <Tag interactive={true} > onClick={()=> window.alert("TODO:实现")}> */}
      <Tag {...props}>
        {type === "cc" && "颜色映射"}
        {type && ARCHIVE_TYPE_TITLE[type]}
        {term}
      </Tag>
    </div>
  </div>
}