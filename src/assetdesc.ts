interface AssetLinkData {
  is_asset_link: true,
  id: string,
  label?: string,
}

type UnknownData = never

export interface RichTextNode {
  text: string,
  style: {
    name: string,
    [K: string]: any,
  }
  anydata: AssetLinkData | UnknownData
}

export type RichText = {
  type: "rich",
  value: RichTextNode[],
}

export type PlainText = {
  type: "plain",
  value: string,
}

export type AssetDesc = Array<RichText | PlainText>