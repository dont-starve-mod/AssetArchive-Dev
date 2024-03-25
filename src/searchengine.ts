import type { AssetDesc, AssetDescLine } from './assetdesc'
import type { FmodEventInfo, FmodProjectInfo } from './components/AppFmodHandler'
import { AssetTag } from './components/AssetDesc'
// import Fuse from 'fuse.js'
// export type FuseResult<T> = Fuse.FuseResult<T>

export type AssetListKey = 
  "allzipfile" |
  "alldynfile" |
  "allxmlfile" |
  "alltexelement" |
  "alltexture" |
  "allfmodevent"

export interface IBasicAsset {
  id: string,
  type: string,
  desc?: AssetDescLine[],
  plain_desc?: string,
}

export interface Tex extends IBasicAsset{
  type: "tex",
  xml: string,
  tex: string,
}

/** *.xml file */
export interface Xml extends IBasicAsset {
  type: "xml",
  file: string,
  texname: string,
  texpath: string,
  _numtex: number,
}

/** *.zip file, usually for animation package */
export interface AnimZip extends IBasicAsset {
  type: "animzip",
  file: string,
}

/** *.dyn file */
export interface AnimDyn extends IBasicAsset {
  type: "animdyn",
  file: string,
}

/** *.tex file without xml referrence, for example: `images/colour_cubes/xxxxxx_cc.tex */
export interface TexNoRef extends IBasicAsset {
  type: "tex_no_ref",
  file: string,
  _is_cc?: true,
}

/** *.ksh file */
export interface Shader extends IBasicAsset {
  type: "shader",
  file: string,
  _ps: string,
  _vs: string,
}

/** sound path, for example: `turnoftides/common/together/moon_glass/mine` */
export interface FmodEvent extends IBasicAsset, FmodEventInfo {
  type: "fmodevent",
  path: string,
}

/** *.fev file */
export interface FmodProject extends IBasicAsset, FmodProjectInfo {
  type: "fmodproject", 
  name: string,
  file: string,
}

type Asset = Tex | Xml | AnimZip | AnimDyn | TexNoRef | Shader | FmodEvent | FmodProject
export type AllAssetTypes = Asset
export type Matches = Array<{indices: Array<[number, number]>, key: string}>

export type EntryPreviewData = {
  tex: string,
  anim: {
    bank: string,
    build: string,
    anim: string,
    animpercent?: number, 
    facing?: number, 
    alpha?: number,
    overridebuild?: string,
    overridesymbol?: [string, string, string, number?][], 
    hidesymbol?: string[], 
    hide?: string[],
  },
  sound?: string,
}

export type Entry = {
  id: string,
  key: string,
  type: "entry",
  alias: string[],
  plain_alias: string,
  desc: string[], // TODO: 应该是RichText
  plain_desc: string,
  source: string[],
  deps: string[],
  assets: Array<{
    id: string,
    type: Asset["type"],
    file?: string,
  }>,
  preview_data: EntryPreviewData,
  tags: {[tag: string]: true},
}

export type Bank = {
  id: string,
  type: "bank",
  bank: number,
  animationList: string[],
  plain_desc?: string,
}

type StaticArchiveItemCommon = {
  desc?: string | JSX.Element,
  plain_desc?: string,
  element?: JSX.Element,
}

export type MultiXml = {
  id: string, // STATIC@multi-xml.Wallpapers
  title: string,
  type: "multi_xml",
  desc?: string | JSX.Element,
  // xmlList: string[], dynamic defined by js function
} & 
StaticArchiveItemCommon

export type MultiSound = {
  id: string, // STATIC@multi-sound.Music
  title: string,
  type: "multi_sound",
  tag?: AssetTag,
} & 
StaticArchiveItemCommon

export type MultEntry = {
  id: string, // STATIC@multi-entry.Fx
  title: string,
  type: "multi_entry",
  tag?: AssetTag,
} &
StaticArchiveItemCommon

export type StaticArchiveItem = MultiXml | MultiSound | MultEntry
export type ArchiveItem = Asset | Entry | Bank | StaticArchiveItem

