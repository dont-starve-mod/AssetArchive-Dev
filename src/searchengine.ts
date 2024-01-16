import Fuse from 'fuse.js'
import type { AssetDesc, AssetDescLine } from './assetdesc'
import type { FmodEventInfo, FmodProjectInfo } from './components/AppFmodHandler'
export type FuseResult<T> = Fuse.FuseResult<T>

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
  project_name: string,
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
export type Result = AllAssetTypes & FuseResult<AllAssetTypes> & { matches: Matches }

export class SearchEngine {
  data: {
    allxmlfile: Xml[],
    alltexelement: Tex[],
    allzipfile: AnimZip[],
    alldynfile: AnimDyn[],
    alltexture: TexNoRef[],
  }
  searchOptions: Fuse.IFuseOptions<Asset> = {
    includeScore: true,
    includeMatches: true,
    shouldSort: false,
    threshold: 0.5,
    ignoreLocation: true,
    keys: [
      {
        name: "id",
        weight: 0.1,
      },
      {
        name: "xml",
        weight: 0.5,
      },
      {
        name: "texpath",
        weight: 0.5,
      },
      {
        name: "_short_name",
        weight: 0.5,
      },
      "file",
      "tex",
      "path", // for fmodevent
    ]
  }
  searcher: {
    [K in keyof SearchEngine["data"]]: Fuse<Asset>
  }
  suffixList = ["png", "dyn", "zip", "tex", "xml", "fev"]

  constructor(data: SearchEngine["data"]) {
    this.data = data
    this.searcher = Object.fromEntries(
      Object.entries(data).map(([k, v])=> [
        k as unknown as SearchEngine["data"],
        new Fuse(v, this.searchOptions)
      ])
    )
  }

  search(query: string): FuseResult<Asset>[] {
    const result: FuseResult<Asset>[][] = []
    Object.entries(this.searcher).forEach(([_, v])=> {
      result.push(v.search(query))
    })
    const suffix = this.suffixList.find(s=> query.toLowerCase().endsWith(s))
    if (suffix !== undefined) {
      return this.sortResultWithSuffix(([]).concat(...result), suffix)
    }
    else {
      return this.sortResult(([]).concat(...result))
    }
  }

  deleteValue(result: FuseResult<Asset>[]): FuseResult<Asset>[] {
    return result.map(item=> {
      (item as any).id = item.item.id
      delete item["item"]
      item.matches.forEach(m=> delete m["value"]) // to reduce return data bytes
      return item
    })
  }

  private value(item: FuseResult<Asset>) {
    let result = null
    let span = 99999
    item.matches.forEach(({indices, value})=> {
      const s = indices[indices.length - 1][1] - indices[0][0]
      if (s < span) {
        span = s
        result = value
      }
    })
    return result
  }

  private compareFn(a: FuseResult<Asset>, b: FuseResult<Asset>) {
    if (Math.abs(a.score - b.score) > 1e-6)
      return a.score - b.score
    const va: string = this.value(a)
    const vb: string = this.value(b)
    if (va.length !== vb.length)
      return va.length - vb.length

    return va === vb ? 0 : va < vb ? -1 : 1
  }

  private sortResult(result: FuseResult<Asset>[]) {
    return result.sort((a, b)=> this.compareFn(a, b))
  }

  private sortResultWithSuffix(result: FuseResult<Asset>[], suffix: string) {
    return result.sort((a, b)=> {
      const va: string = this.value(a)
      const vb: string = this.value(b)
      const ea = va.endsWith(suffix)
      const eb = vb.endsWith(suffix)
      if (ea === eb)
        return this.compareFn(a, b)
      else if (ea) {
        return -1
      }
      else {
        return 1
      }
    })

  }
}