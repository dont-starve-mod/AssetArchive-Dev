import React from 'react'
import MultiplyXmlViewer from '../../components/MultiplyXmlViewer'
import { StaticArchiveItem } from '../../searchengine'
import { H3 } from '@blueprintjs/core'

export function initStaticPageData(){
  window.assets.allstaticpage = [
    {
      id: "Wallpapers",
      title: "所有壁纸（正在加载图像）",
      desc: <>
        <p>在游戏加载过程中显示的图片，文件名均以“loading_”开头。</p>
        <p>在下方输入框内快速筛选，如“温蒂”。</p>
      </>,
      type: "multi_xml",
    },
    {
      id: "Scrapbooks",
      title: "所有图鉴",
      desc: <>
        <p>下方输入“icon”可快速筛选圆形图标，这些也许对你很有用。</p>
      </>,
      type: "multi_xml",
    },
    {
      id: "CharacterPortraits",
      title: "所有角色立绘",
      desc: <>
        <p>名字里带有“none”的是原始立绘，其他的是皮肤。</p>
        <p>方形立绘已被弃用。</p>
      </>,
      type: "multi_xml",
    },
    {
      id: "Minimaps",
      title: "所有小地图图标",
      type: "multi_xml",
    },
    {
      id: "InventoryImages",
      title: "所有物品图标",
      desc: <>
        <p>物品栏、装备栏、背包栏、箱子等方格中显示的图片，分辨率均为64✕64。
          所有制作配方的图片也放在此处（尽管有一些并不属于可携带物品，如火堆、科学机器）。</p>
        <p>images/inventoryimages.xml是游戏早期版本使用的图集，
          随着游戏内容增加，物品栏图标数量过多，拆分成多个图集。images/inventoryimages.xml目前已被弃用，
          游戏真正加载的文件是images/inventoryimages1.xml、images/inventoryimages2.xml和images/inventoryimages3.xml。</p>
        <p>在下方搜索你感兴趣的图片，如“眼骨”。</p>
      </>,
      type: "multi_xml",
    },
    {
      id: "Skilltrees",
      title: "所有技能树图标",
      type: "multi_xml",
    },
    {
      id: "UI",
      title: "常用的UI组件",
      desc: <>
        <p>包括按钮、输入框、单选框、背景板等。</p>
      </>,
      type : "multi_xml",
    }
  ]

  window.assets.allstaticpage.forEach(v=> {
    const id = v.id
    v.id = `STATIC@${v.type}.${id}`
    if (v.type === "multi_xml") {
      const C = MultiplyXmlViewer[id]
      if (!C) console.error(`No static component for ${v.id}`)
      v.element = <C/>
    }
    window.assets_map[v.id] = v
  })
}

export default function StaticPage(props: StaticArchiveItem) {
  const {id, title, element, desc} = props
  return (
    <div>
      <H3>{title}</H3>
      <div className="bp4-running-text" style={{marginTop: 10}}>
        {desc}
        <div style={{height: 16}}></div>
        {element}
      </div>
    </div>
  )
}
