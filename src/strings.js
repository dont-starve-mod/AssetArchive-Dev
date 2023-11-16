export const ASSET_TYPE = {
  tex: "图片",
  xml: "图集",
  animzip: "动画包",
  animdyn: "动态材质包",
  tex_no_ref: "纹理",
  fmodevent: "音效",
  fmodproject: "音效包",
}

export const ENTRY_TYPE = {
  entry: "词条",
}

export const SEARCH_RESULT_TYPE = [
  {
    key: "entry",
  },
  {
    key: "tex",
  },
  {
    key: "xml",
  },
  {
    key: "animzip",
  },
  {
    key: "animdyn",
  },
  {
    key: "tex_no_ref"
  },
  {
    key: "fmodevent",
  },
  {
    key: "fmodproject",
  }
]

{
  let NAMES = {...ASSET_TYPE, ...ENTRY_TYPE}
  SEARCH_RESULT_TYPE.forEach(t=> {
    t.name = NAMES[t.key]
  })
}

export const UI = {
  hint: "提示",
}