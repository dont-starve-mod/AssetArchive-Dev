import { useEffect, useState } from 'react'
import { H3, H5, Icon, Tag } from "@blueprintjs/core"
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api'
import { openChangeLog } from '../ChangeLog'

function openURL(url: string) {
  invoke("open_url", { url })
}

export default function About() {
  const [version, setVersion] = useState("")
  useEffect(()=> {
    getVersion().then(v=> setVersion(v))
  }, [])

  return (
    <div className="bp4-running-text">
      <H3 style={{marginTop: 15}}>
        饥荒资源档案
        <Tag minimal style={{marginBottom: 2, marginLeft: 4, verticalAlign: "middle"}}>
          <span>v-{version}</span>
        </Tag>
      </H3>
      <p>一站式饥荒游戏资源检索工具——只需轻点几下，即可快速导出图片、动画、音效、滤镜等游戏资源。</p>
      <SimpleLink url="https://archive.lwdocs.cn">网站首页</SimpleLink>
      <a className="ml-5" onClick={()=> openChangeLog()}>
        更新日志
        <Icon icon="share" size={12} className="align-middle ml-1" />
      </a>
      <H5>使用声明</H5>
      <p>本软件仅提供对饥荒游戏资源文件的读取和导出功能，软件本体不携带游戏资源文件，您在使用前应先在设备上安装正版饥荒游戏，并确保游戏文件的完整性。
        因安装盗版游戏或修改游戏资源导致软件运行的任何问题，本软件概不负责。
      </p>
      <p>饥荒游戏素材的版权与最终解释权归 <a href="#" onClick={()=> openURL("https://klei.com")}>Klei Entertainment（科雷娱乐）</a>所有，
      您应仅将本软件导出的游戏素材用于非商业性目的，如饥荒模组制作、二创视频创作、Wiki编写和学习交流等。 </p>
      <p>本软件永久免费，如果您通过任何付费渠道下载，请联系退款。</p>
      <H5 id="bug">
        bug反馈
      </H5>
      {/* <p>该版本为测试版本，处于活跃更新状态，如遇bug可在<a onClick={()=> openURL("https://support.qq.com/product/632056/")}>讨论区</a>反馈 (๑•̀ㅂ•́)و✧</p> */}
      <p>该版本为测试版本，处于活跃更新状态，如遇bug可在
        <SimpleLink url="https://support.qq.com/product/632056/">讨论区</SimpleLink>
        &nbsp;反馈。 (๑•̀ㅂ•́)و✧</p>
      <H5>
        友情链接
      </H5>
      <p>
        <SimpleLink url="https://www.klei.com/games/dont-starve-together">《饥荒联机版》游戏官网</SimpleLink>
      </p>
      <p>
        <SimpleLink url="https://dontstarve.huijiwiki.com/wiki/首页">饥荒维基</SimpleLink>
      </p>
      <p>
        <SimpleLink url="https://github.com/kleientertainment/ds_mod_tools">Don't Starve Mod Tools</SimpleLink>
        （官方提供的模组制作和发布工具包）
      </p>
      <p>
        <SimpleLink url="https://forums.kleientertainment.com/files/file/73-handsome-matts-tools/">textool</SimpleLink>
        （dxt贴图文件查看器）
      </p>
      <p>
        <SimpleLink url="https://forums.kleientertainment.com/files/file/583-ktools-cross-platform-modding-tools-for-dont-starve/">ktools</SimpleLink>
        （饥荒动画和贴图反编译工具）
      </p>
      <p>
        <SimpleLink url="https://steamcommunity.com/sharedfiles/filedetails/?id=2910584141">dsanimtool</SimpleLink>
        （Spine到饥荒动画转换器）
      </p>
      {/* <p>B站关注<a onClick={()=> open("https://space.bilibili.com/209631439")}>@老王天天写bug</a>，获取最新更新动态。</p> */}
    </div>
  )
}

function SimpleLink(props: {children: string, url: string}) {
  return (
    <a href="#" onClick={()=> openURL(props.url)}>
      {props.children} 
      <Icon icon="share" size={12} className="align-middle ml-1" />
    </a>
  )
}
