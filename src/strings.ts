export const ARCHIVE_TYPE_TITLE = {
  tex: "图片",
  xml: "图集",
  animzip: "动画包",
  animdyn: "动态材质包",
  tex_no_ref: "纹理",
  shader: "着色器",
  fmodevent: "音效",
  fmodproject: "音效包",
  bank: "动画库",
  misc: "杂项",

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
  },
  {
    key: "misc",
  }
]

{
  let TITLE = {...ARCHIVE_TYPE_TITLE}
  SEARCH_RESULT_TYPE.forEach(t=> {
    //@ts-ignore
    t.name = TITLE[t.key]
  })
}

export const UI = {
  hint: "提示",
}