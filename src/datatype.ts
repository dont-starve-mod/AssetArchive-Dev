export interface IBasicAssetItem {
  id: string,
  type: string,

  [k: string]: any,
}

export interface ITexData extends IBasicAssetItem{
  type: "tex",
  xml: string,
  tex: string,
}

export interface IXmlData extends IBasicAssetItem {
  type: "xml",
  file: string,
  texname: string,
  texpath: string,
  _numtex: number,
}

export interface IAnimData extends IBasicAssetItem {
  type: "animzip",
  file: string,
}

export interface IDynData extends IBasicAssetItem {
  type: "animdyn",
  file: string,
}

export type AllAssetTypes = ITexData | IXmlData | IAnimData | IDynData