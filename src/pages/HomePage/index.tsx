import { Button, Card, H3, H4, H5, H6, Icon } from '@blueprintjs/core'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useAppSetting, useLocalStorage, useOS } from '../../hooks'
import { useNavigate } from 'react-router-dom'
import * as clips from './clips'
import style from './index.module.css'
import { ArchiveItem, StaticArchiveItem, TexNoRef } from '../../searchengine'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'
import smallhash from '../../smallhash'

type SubCardProps = {
  title: string,
  imgSrc?: any,
  style?: React.CSSProperties,
  onClick?: ()=> void,
  children?: JSX.Element,
}

function SubCard(props: SubCardProps) {
  const {title, imgSrc, onClick} = props
  return (
    <Card interactive onClick={onClick} style={props.style}>
      <H6>{title}</H6>
      {
        imgSrc && <img src={imgSrc} className={style['clip']}/>
      }
      {
        props.children
      }
    </Card>
  )
}

export default function HomePage() {
  const {isMacOS} = useOS()
  const [root] = useAppSetting("last_dst_root")
  const navigate = useNavigate()

  const searchKey = useMemo(()=> {
    return (
      <span className='bp4-key-combo'>
        <kbd className='bp4-key'>
          {
            isMacOS ? <Icon icon="key-command"/> : <Icon icon="key-control"/>
          }
          <span style={{fontSize: "150%"}}>P</span>
        </kbd>
      </span>
    )
  }, [isMacOS])

  // TODO: 确保重定向到welcome
  // useEffect(()=> {
  //   let timer = setTimeout(()=> {
  //     if (!root) navigate("/welcome")
  //   }, 1000)
  //   return ()=> clearTimeout(timer)
  // }, [root])

  const colorMatrix = [
    .4, 0, 0, 0, .1,
    0, .4, 0, 0, .1,
    0, 0, .4, 0, .1,
    0, 0, 0, .4, 0,
  ].join(" ")

  const randomAsset = useRandomAsset()
  const toStatic = useCallback((type: StaticArchiveItem["type"], name: string)=> {
    navigate(`/asset?id=STATIC@${type}.${name}`)
  }, [navigate])

  const toMultiXml = useCallback((name: string)=> {
    toStatic("multi_xml", name)
  }, [toStatic])

  const [_, setSelected] = useLocalStorage("entry_filter_selected")
  const toEntrySearcher = useCallback((tags: string[])=> {
    setSelected(Object.fromEntries(tags.map(v=> [v, true])))
    navigate(`/entry-searcher`)
  }, [navigate, setSelected])

  return (
    <KeepAlivePage.NoDev cacheNamespace="assetPage">
      <div className={'bp4-running-text ' + style["home"]}>
        <H3 style={{marginTop: 15}}>游戏资源</H3>
        <svg height="0" style={{position: "absolute"}}>
          <filter id={"grey"}>
            <feColorMatrix values={colorMatrix}/>
          </filter>
        </svg>
        <H5>搜索</H5>
        {/* <Card interactive style={{display: "inline-flex"}}> */}
          <p>点击右上角的搜索框，查找你感兴趣的游戏资源。 <Icon icon="arrow-top-right"/> </p>
        {/* </Card> */}
        {/* <H5>生物</H5>
        <div className={style["card-box"]}>
          <SubCard title="中立生物" imgSrc={clips.neutral}/>
          <SubCard title="敌对生物" imgSrc={clips.hostile}/>
          <SubCard title="友好生物" imgSrc={clips.passive}/>
          <SubCard title="Boss" imgSrc={clips.epic}/>
          <SubCard title="地面生物" imgSrc={clips.surface}/>
          <SubCard title="洞穴生物" imgSrc={clips.cave} style={{overflow: "hidden"}}/>
          <SubCard title="海洋生物" imgSrc={clips.ocean}/>
          <SubCard title="全部" imgSrc={clips.all}/>
        </div>
        <H5>物品</H5>
        <div className={style["card-box"]}>
          <SubCard title="战斗物品" imgSrc={clips.combat}/>
          <SubCard title="生存道具" imgSrc={clips.suvive}/>
          <SubCard title="光源" imgSrc={clips.light}/>
          <SubCard title="制造" imgSrc={clips.crafting}/>
          <SubCard title="食物" imgSrc={clips.food}/>
          <SubCard title="料理" imgSrc={clips.preparedfood}/>
          <SubCard title="全部" imgSrc={clips.all}/>
        </div> */}
        <H5>图片</H5>
        <div className={style["card-box"]}>
          <SubCard title="人物立绘" imgSrc={clips.bigportrait} onClick={()=> toMultiXml("CharacterPortraits")}/>
          <SubCard title="壁纸" imgSrc={clips.wallpaper} onClick={()=> toMultiXml("Wallpapers")}/>
          <SubCard title="物品图标" imgSrc={clips.inv} onClick={()=> toMultiXml("InventoryImages")}/>
          <SubCard title="小地图图标" imgSrc={clips.minimap} onClick={()=> toMultiXml("Minimaps")}/>
          <SubCard title="图鉴" imgSrc={clips.scrapbook} onClick={()=> toMultiXml("Scrapbooks")}/>
          <SubCard title="技能树" imgSrc={clips.skilltree} onClick={()=> toMultiXml("Skilltrees")}/>
          <SubCard title="UI" imgSrc={clips.ui} onClick={()=> toMultiXml("UI")}/>
        </div>
        <H5>词条</H5>
        <div className={style["card-box"]}>
          <SubCard title="生物" imgSrc={clips.passive} onClick={()=> toEntrySearcher(["type.creature", "type.giant"])} />
          <SubCard title="Boss" imgSrc={clips.epic} onClick={()=> toEntrySearcher(["type.giant"])}/>
          <SubCard title="物品" imgSrc={clips.item} onClick={()=> toEntrySearcher(["type.item"])}/>
          <SubCard title="战斗道具" imgSrc={clips.combat} onClick={()=> toEntrySearcher(["subcat.weapon", "subcat.armor"])}/>
          <SubCard title="食物" imgSrc={clips.food} onClick={()=> toEntrySearcher(["type.food"])}/>
          <SubCard title="料理" imgSrc={clips.preparedfood} onClick={()=> toEntrySearcher(["preparedfood"])}/>
          <SubCard title="角色专属物品" imgSrc={clips.characteritem} onClick={()=> toEntrySearcher([
            "crafted_by.walter", "crafted_by.wanda", "crafted_by.warly", "crafted_by.wathgrithr", "crafted_by.waxwell",
            "crafted_by.webber", "crafted_by.wendy", "crafted_by.wes", "crafted_by.wickerbottom", "crafted_by.willow",
            "crafted_by.winona", "crafted_by.wolfgang", "crafted_by.woodie", "crafted_by.wormwood", "crafted_by.wurt",
            "crafted_by.wx78"])}/>
          <SubCard title="事物" imgSrc={clips.thing} onClick={()=> toEntrySearcher(["type.thing"])}/>
          <SubCard title="建筑" imgSrc={clips.structure} onClick={()=> toEntrySearcher(["subcat.structure"])}/>
          <SubCard title="兴趣点" imgSrc={clips.poi} onClick={()=> toEntrySearcher(["type.poi"])}/>
        </div>
        <H5>人物动画</H5>
        <div className={style["card-box"]}>
          <SubCard title="基础动画" imgSrc={clips.wilson} onClick={()=> navigate("/asset?id=bank-"+smallhash("wilson"))}/>
          <SubCard title="骑牛动画" imgSrc={clips.wilsonbeefalo} onClick={()=> navigate("/asset?id=bank-"+smallhash("wilsonbeefalo"))}/>
        </div>
        <H5>声音</H5>
        <div className={style["card-box"]}>
          <SubCard title="音乐" imgSrc={clips.music} onClick={()=> toStatic("multi_sound", "Music")}/>
          <SubCard title="人物语音" imgSrc={clips.voice} onClick={()=> toStatic("multi_sound", "CharacterVoice")}/>
          <SubCard title="环境声" imgSrc={clips.amb} onClick={()=> toStatic("multi_sound", "AmbientSound")}/>
          <SubCard title="所有音效包" imgSrc={clips.allfev} onClick={()=> navigate("/search?q=.fev&tab=fmodproject")}/>
        </div>
        <H5>虫洞</H5>
        <p>这是一个神秘的虫洞，它可以通向任何地方...</p>
        <div className={style["card-box"]}>
          <SubCard title="随机动画包" imgSrc={clips.ran} onClick={()=> randomAsset("animzip")}/>
          <SubCard title="随机动画库" imgSrc={clips.ran} onClick={()=> randomAsset("bank")}/>
          <SubCard title="随机图片" imgSrc={clips.ran} onClick={()=> randomAsset("tex")}/>
          <SubCard title="随机滤镜" imgSrc={clips.ran} onClick={()=> randomAsset("cc")}/>
          <SubCard title="随机音效" imgSrc={clips.ran} onClick={()=> randomAsset("fmodevent")}/>
          <SubCard title="随机着色器" imgSrc={clips.ran} onClick={()=> randomAsset("shader")}>
            <p className={style["hidden-hint"]}>你是认真的吗？</p>
          </SubCard>
          <SubCard title="随机游戏资源" imgSrc={clips.ran} onClick={()=> randomAsset("any")}/>
        </div>
      </div>
    </KeepAlivePage.NoDev>

  )
}

function useRandomAsset() {
  const navigate = useNavigate()
  return useCallback((type: ArchiveItem["type"] | "cc" | "any")=> {
    let field = ""
    switch (type) {
      case "animzip":
        field = "allzipfile"
        break
      case "bank":
        field = "allbank"
        break
      case "fmodevent":
        field = "allfmodevent"
        break
      case "shader":
        field = "allkshfile"
        break
      case "fmodproject":
        field = "allfmodproject"
        break
      case "tex":
        field = "alltexelement"
        break
      case "cc":
        field = "alltexture"
        break
      case "any":
        field = randomChoice(["allzipfile", "allbank", "allfmodevent", "alltexelement"])
        break
    }
    let items = window.assets[field] as ArchiveItem[]
    if (type === "cc"){
      items = items.filter((v: TexNoRef)=> v._is_cc)
    }
    const asset = randomChoice(items)
    navigate(`/asset?id=${asset.id}`)
  
  }, [navigate])
}

function randomChoice<T>(list: T[]) {
  if (list.length > 0){
    return list[Math.floor(Math.random()* list.length)]
  }
}

// @ts-ignore
window.all_music =()=> {
  return window.assets.allfmodevent.filter(v=> {
    return v.category.indexOf("music") !== -1
  })
}