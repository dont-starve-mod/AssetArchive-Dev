import type { Api } from "../AnimCore_Canvas/animstate"

type ApiDoc = {
  /** SetBank, SetBuild, ... */
  name?: string,
  /** "设置材质", ... */
  title?: string,
  desc?: React.ReactNode,

  

}

// @ts-ignore
export const API_DOC: {
  [K in Api["name"]]: ApiDoc
} = {}

const OVERRIDE_HINT = "如果重复使用该命令，只有最后的会生效"

API_DOC["SetBank"] = {
  title: "设置动画库",
  desc: (
    <>
      <p>设置动画库（Bank）的名字。</p>
      <p>动画库是唯一的，{OVERRIDE_HINT}。</p>
    </>
  ),
}

API_DOC["SetBuild"] = {
  title: "设置材质",
  desc: (
    <>
      <p>设置材质（Build）的名字。</p>
      <p>材质决定了物体的基本形态外观和颜色，</p>
      <p>材质是唯一的，{OVERRIDE_HINT}。</p>
    </>
  )
}
