import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { H3, H4, H5, H6, Icon, NonIdealState, Button, Card, Spinner, Checkbox, Menu, MenuItem, Callout, InputGroup, Tag, Pre } from '@blueprintjs/core'
import { ButtonGroup } from '@blueprintjs/core'
import { ASSET_TYPE } from '../../strings'
import { useLuaCall, useCopyTexElement, useCopyBuildAtlas, useCopySymbolElement, useCopySuccess, useSaveFileCall, useCopyTexture, useLuaCallOnce, useSaveFileDialog, useBatchDownloadDialog, useLocalStorage } from '../../hooks'
import { appWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/api/clipboard'
import style from './index.module.css'
import Preview, { killPreviewSfx } from '../../components/Preview'
import ClickableTag from '../../components/ClickableTag'
import Hash from '../../components/HumanHash'
import FacingString from '../../components/FacingString'
import CCMiniPlayground from '../../components/CCMiniPlayground'
import KeepAlivePage, { KeepAlivePageProps } from '../../components/KeepAlive/KeepAlivePage'
import AtlasUVMapViewer from '../../components/AtlasUVMapViewer'
import AssetFilePath from '../../components/AssetFilepath'
import BatchDownloadButton from '../../components/BatchDownloadButton'
import { FmodEvent, FmodProject, Shader } from '../../searchengine'
import SfxPlayer from '../../components/SfxPlayer'
import { AccessableItem } from '../../components/AccessableItem'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import Code from '../../components/Code'
import AssetDesc from '../../components/AssetDesc'
import { search } from '../../global_meilisearch'

function KeepAlive(props: Omit<KeepAlivePageProps, "cacheNamespace">) {
  return <KeepAlivePage {...props} cacheNamespace="assetPage"/>
}

function getTypeKeyById(id: string): string {
  switch(id.substring(0, 1)){
    case "d": return "alldynfile"
    case "z": return "allzipfile"
    case "t": return "alltexelement"
    case "x": return "allxmlfile"
    case "n": return "alltexture"
    case "r": return "allkshfile"
    case "f": return id.startsWith("fev") ? "allfmodproject" : "allfmodevent"
  }
  throw Error("Failed to get type key: " + id)
}

export default function AssetPage() {
  const [param] = useSearchParams()
  const id = param.get("id")
  const [_, forceUpdate] = useReducer(v=> v + 1, 0)

  if (id === null) return <AssetInvalidPage type="null"/>
  const asset = window.assets_map[id]
  if (!asset) {
    if (!window.assets[getTypeKeyById(id)]){
      return <AssetInvalidPage type="waiting" forceUpdate={forceUpdate}/>
    }
    else {
      console.warn("Invalid asset id: ", id)
      return <AssetInvalidPage type="invalid-id" id={id}/>
    }
  }

  const {type} = asset
  switch(type) {
    case "tex": 
      return <KeepAlive key={id}>
        <TexPage {...asset} key={id}/>
      </KeepAlive>
    case "xml": 
      return <KeepAlive key={id}>
        <XmlPage {...asset} key={id}/>
      </KeepAlive>
    case "animzip": 
      return <KeepAlive key={id}>
        <ZipPage {...asset} key={id}/>
      </KeepAlive>
    case "animdyn":
      return <KeepAlive key={id}>
        <ZipPage {...asset} key={id}/>
      </KeepAlive>
    case "tex_no_ref":
      if (asset._is_cc)
        // cc page contains webgl canvas, don't cache it
        return <TexNoRefPage {...asset} key={id} is_cc={true}/>
      else
        return <KeepAlive key={id}>
          <TexNoRefPage {...asset} key={id}/>
        </KeepAlive>
    case "shader":
      return <ShaderPage {...asset} key={id}/>
    case "fmodevent":
      return <FmodEventPage {...asset} key={id}/>
    case "fmodproject":
      return <KeepAlive key={id}>
        <FmodProjectPage {...asset} key={id}/>
      </KeepAlive>
    default:
      return <AssetInvalidPage type="invalid-type" typeName={type}/>
  }
}

function AssetType(props) {
  return <ClickableTag {...props}/>
}

function Star({}) {
  return <div style={{display: "inline-block"}}>
    <Icon icon="star-empty"/>
  </div>
}

function Loading({loading}) {
  if (loading){
    return <div style={{width: 70, height: 100}}>
      <Spinner/>
    </div>
  }
}

const TEX_MINI_WIDTH = 300

function TexPage({id, xml, tex}) {
  const navigate = useNavigate()
  const xmlDef = window.assets.allxmlfile.find(a=> a.file === xml)
  const atlasPath = xmlDef ? xmlDef.texpath : "获取失败"
  const ref = useRef<HTMLImageElement>()
  const [resolution, setResolution] = useState([0, 0])
  const [loading, setLoading] = useState(true)
  const [resizable, setResizeable] = useState(true)
  const [isMaximized, setMaximised] = useLocalStorage("tex_maximized")
  const [gridBackground, setGridBackground] = useLocalStorage("tex_use_grid_background")

  useLuaCallOnce<number[]>("load", result=> {
    const array = Uint8Array.from(result)
    const blob = new Blob([array])
    createImageBitmap(blob).then(img=> {
      setResolution([img.width, img.height])
      setResizeable(img.width > TEX_MINI_WIDTH)
    })
    if (ref.current) {
      ref.current.src = URL.createObjectURL(blob)
    }
    setLoading(false)
  }, {type: "image", xml, tex, format: "png", debug:1}, 
    [id, xml, tex, setResolution, setLoading, setResizeable])

  const download = useSaveFileCall(
    {type: "image", xml, tex}, 
    "image",
    tex + ".png",
  [id, xml, tex])

  const copy = useCopyTexElement(xml, tex)

  const transparentStyle: React.CSSProperties = {
    backgroundImage: "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)",
    backgroundColor: "#555",
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0, 8px 8px",
  }

  const onClickImg = useCallback(()=> {
    if (isMaximized) {
      // TODO: reset article scroll
    }
    setMaximised(!isMaximized)
  }, [isMaximized])

  return <div>
    <H3>{tex} <AssetType type="tex"/></H3>
    <div className="bp4-running-text">
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <H5>图片&nbsp;
        <Tooltip2 content={gridBackground ? "深色背景": "透明背景"}>
          <Button icon="contrast" intent={gridBackground ? "primary" : "none"}
            onClick={()=> setGridBackground(!gridBackground)}/>
        </Tooltip2>
      </H5>
      <Loading loading={loading}/>
      <img style={{
        maxWidth: isMaximized ? "100%" : TEX_MINI_WIDTH, 
        maxHeight: "80vh", 
        display: loading ? "none" : null,
        cursor: resizable ? (isMaximized ? "zoom-out" : "zoom-in") : "default",
        ...(gridBackground ? transparentStyle : {})}} 
        className='bp4-elevation-1' ref={ref} onClick={onClickImg}/>
      <div style={{height: 20}}></div>
      <Button icon="duplicate" onClick={()=> copy()} disabled={loading}>
        拷贝
      </Button>
      &nbsp;
      <Button icon="download" onClick={()=> download()} disabled={loading}>
        下载
      </Button>
      <H5>基本信息</H5>
      <p>分辨率: {resolution[0]}✕{resolution[1]}</p>
      <AssetFilePath type="xml_link" path={xml}/>
      <AssetFilePath type="tex" path={atlasPath}/>
    </div>
  </div>
}

function TexNoRefPage({id, file, is_cc}: {id: string, file: string, is_cc?: boolean}) {
  const [resolution, setResolution] = useState([0, 0])
  const [loading, setLoading] = useState(true)
  const [url, setURL] = useState("")
  const [isMaximized, setMaximised] = useLocalStorage("tex_maximized")
  const [resizable, setResizeable] = useState(true)
  
  const onImgLoad = ({target})=> {
    // setResolution([target.width, target.height])
    setLoading(false)
  }

  useLuaCallOnce<number[]>("load", result=> {
    const array = Uint8Array.from(result)
    const blob = new Blob([array])
    createImageBitmap(blob).then(img=> {
      setResolution([img.width, img.height])
      setResizeable(img.width > TEX_MINI_WIDTH)
    })
    setURL(URL.createObjectURL(blob))
  }, {type: "texture", file, format: "png"}, 
    [file])

  const download = useSaveFileCall(
    {type: "texture", file},
    "image",
    file + ".png", [id, file])

  const copy = useCopyTexture(file)

  return <div>
    <H3>{file} 
      <AssetType type="tex_no_ref"/>
      { is_cc && <AssetType type="cc"/> }
    </H3>
    <div className="bp4-running-text">
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <H5>图片</H5>
      <Loading loading={loading}/>
      <img style={{
        maxWidth: isMaximized ? "100%" : TEX_MINI_WIDTH, 
        cursor: resizable ? (!isMaximized ? "zoom-in" : "zoom-out") : "default",
        maxHeight: "80vh", display: loading ? "none" : null
      }} 
        className='bp4-elevation-1' src={url} onLoad={onImgLoad}
        onClick={()=> setMaximised(!isMaximized)}/>
      <div style={{height: 20}}></div>
      <Button icon="duplicate" onClick={()=> copy()} disabled={loading}>
        拷贝
      </Button>
      &nbsp;
      <Button icon="download" intent='primary' onClick={()=> download()} disabled={loading}>
        下载
      </Button>
      <H5>基本信息</H5>
      <p>分辨率: {resolution[0]}✕{resolution[1]}</p>
      <p>资源路径: {file} &nbsp;
        <Button icon="document-open" minimal={true}/>
      </p>
      {
        is_cc && url.length > 0 && <CCMiniPlayground cc={url}/>
      }
      {
        // is_cc && <CCMapViewer file={file}/>
      }
    </div>
  </div>
}

export type XmlData = {
  xml: string,
  width: number,
  height: number,
  elements: Array<{
    name: string,
    uv: [number, number, number, number],
    width: number,
    height: number,
    id: string,
  }>
}

function XmlPage({id, file, texpath, _numtex}) {
  const [display, setDisplay] = useState<"grid"|"list"|"atlas">("grid") // TODO: 应该是可保存的config
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<XmlData>()

  useLuaCallOnce<string>("load", result=> {
    setData(JSON.parse(result))
    setLoading(false)
  }, {type: "xml", file},
    [file])
  
  return <div>
    <H3>{file} <AssetType type="xml"/></H3>
    <div className="bp4-running-text">
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <H5>图片列表 </H5>
      <p>本图集包含{_numtex}张图片&nbsp; 
        <BatchDownloadButton type="xml" file={file}/>
      </p>
      <p>
        视图&nbsp;&nbsp;
        <ButtonGroup minimal={false} style={{verticalAlign: "middle"}}>
          <Button icon="grid-view" onClick={()=> setDisplay("grid")} intent={display === "grid" ? "primary": null}/>
          <Button icon="list" onClick={()=> setDisplay("list")} intent={display === "list" ? "primary": null}/>
          <Button icon="widget" onClick={()=> setDisplay("atlas")} intent={display === "atlas" ? "primary": null}/>
        </ButtonGroup>
      </p>
      <Loading loading={loading}/>
      {
        data && data.elements && data.xml === file && (<>
          <div style={{display: display === "grid" ? "block" : "none"}}>
            <XmlPageDisplay.Grid data={data} xml={file}/>
          </div>
          <div style={{display: display === "list" ? "block" : "none"}}>
            <XmlPageDisplay.List data={data} xml={file}/>
          </div>
          <div style={{display: display === "atlas" ? "block" : "none"}}>
            <XmlPageDisplay.Atlas data={data} xml={file} texpath={texpath}/>
          </div>
        </>)
      }
      <H5>基本信息</H5>
      <AssetFilePath type="xml" path={file}/>
      <AssetFilePath type="tex" path={texpath}/>
    </div>
  </div>
}

type XmlDisplayProps = {
  data: XmlData,
  xml: string,
}

const XmlPageDisplay = {
  Grid(props: XmlDisplayProps) {
    const {data, xml} = props
    const navigate = useNavigate()
    const copy = useCopyTexElement(xml, null)
    const download = useSaveFileCall(
      {type: "image", xml},
      "image",
      "image.png", [xml])

    const skipButton = e=> e.target.className.indexOf("button-group") !== -1
    
    return <div className={style["grid-container"]}>
      {
        data.elements.map((element, _)=> 
        <div className={style["grid"]} key={element.id}>
          <div className='bp4-card'>
            <Preview.Image xml={xml} tex={element.name} width={80} height={80}/>
            <div className={style['grid-name']}>
              <p className="bp4-monospace-text">
                {element.name}
              </p>
            </div>
            <div className={style['grid-button-group']} onClick={(e)=> skipButton(e) && navigate("/asset?id="+element.id)}>
              <div style={{margin: "0 auto", display: "block", width: 80}}>
                <ButtonGroup vertical={true} fill={true}>
                  <Button icon="download" onClick={()=> download({tex: element.name, defaultPath: element.name})} intent='primary'>下载</Button>             
                  <Button icon="duplicate" onClick={()=> copy({tex: element.name})}>拷贝</Button>                
                  {/* <Button icon="info-sign" onClick={()=> navigate("/asset?id="+element.id)}>详情</Button>                 */}
                </ButtonGroup>
              </div>
            </div>
          </div>
        </div>)
      }
    </div>
  },

  List(props: XmlDisplayProps) {
    const {data, xml} = props
    const navigate = useNavigate()
    const copy = useCopyTexElement(xml, null)
    const download = useSaveFileCall(
      {type: "image", xml},
      "image",
      "image.png", [xml])

    return <table className={style["list-container"]} border={0}>
      <thead>
        {/* <th><Checkbox inline={true} style={{marginRight: 0}} /></th> */}
        <th>名字</th>
        <th>分辨率</th>
        <th>图片</th>
        <th>&nbsp;操作</th>
      </thead>
      <tbody>
      {
        data.elements.map((element, _)=> 
        <tr key={element.id}>
          {/* <td>
            <Checkbox/>
          </td> */}
          <td>
            <p className={style["list-name"] + " bp4-monospace-text"} onClick={()=> navigate("/asset?id="+element.id)}>
              {element.name}
            </p>
          </td>
          <td>{element.width}✕{element.height}</td>
          <td><Preview.Image xml={xml} tex={element.name} width={40} height={40}/></td>
          <td>
            <span style={{width: 8, display: "inline-block"}}/>
            <Button icon="duplicate" onClick={()=> copy({tex: element.name})}/>
            <span style={{width: 8, display: "inline-block"}}/>
            <Button icon="download" onClick={()=> download({tex: element.name, defaultPath: element.name})}/>
          </td>
        </tr>)
      }
      </tbody>
    </table>
  },

  Atlas(props: XmlDisplayProps & { texpath: string }) {
    const {data, texpath} = props
    return <div>
      <AtlasUVMapViewer data={data} texpath={texpath} xml={props.xml}/>
    </div>
  },
}

const SWAP_ICON = 4138393349

function formatElementSize(element: any, atlas: any): string {
  atlas = atlas && atlas[element.sampler]
  if (atlas) {
    let {width, height} = atlas
    let {cw, ch, w, h} = element
    w = Math.floor(w * width / cw + 0.5)
    h = Math.floor(h * height / ch + 0.5)
    return `${w}✕${h}`
  }
}

function ZipPage({type, file, id}) {
  const [build, setBuildData] = useState(undefined)
  const [unfoldSymbol, setUnFoldSymbol] = useState({})
  const [animList, setAnimList] = useState(undefined)
  const [atlas, setAtlas] = useState({})
  const [swap_icon, setSwapIconData] = useState<any>()

  useLuaCallOnce<string>("load", result=> {
    if (result == "nil") {
      // `build.bin` not exists
      setBuildData(false)
    }
    else {
      const data = JSON.parse(result)
      setBuildData(data)
      const swap_icon = data.symbol.find(v=> v.imghash === SWAP_ICON)
      if (swap_icon && swap_icon.imglist.length) {
        setSwapIconData(swap_icon.imglist[0])
      }
    }
  }, {type: "build", file}, [file])

  useLuaCallOnce<string>("load", result=> {
    if (result == "nil") {
      // `anim.bin` not exists
      setAnimList(false)
    }
    else {
      console.log(result)
      setAnimList(JSON.parse(result))
    }
  }, {type: "animbin", file}, [file])

  const copyAtlas = useCopyBuildAtlas(file)
  const copyElement = useCopySymbolElement(file)
  const downloadAtlas = useSaveFileCall({
    type: "atlas", build: file, check_permission: true, 
  }, "image", "atlas.png", [file])
  const downloadElement = useSaveFileCall({
    type: "symbol_element", build: file, check_permission: true,
  }, "image", "image.png", [file])

  const onSuccess = useCopySuccess()

  return <div>
    <H3>{file} <AssetType type={type}/></H3>
    <div className="bp4-running-text">
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <H5>材质 <ClickableTag term="build"/></H5>
      {
        build === false ? "本资源包内不包含材质。" :
        build !== undefined ? <>
          <p><strong>名字</strong></p>
          <p className='bp4-monospace-text'>
            {build.name}&nbsp;<Button icon="duplicate" onClick={()=> 
              writeText(build.name).then(()=> onSuccess())}/>
          </p>
          {
            Boolean(swap_icon) &&
            <div>
              <p><strong>皮肤图标</strong></p>
              <div style={{marginBottom: 10, display: "flex"}}>
                <Preview.SymbolElement atlas={atlas} data={swap_icon} width={50} height={50}/>
                <div style={{width: 10}}/>
                <Button icon="duplicate" style={{margin: "auto 2px"}} 
                  onClick={()=> copyElement({imghash: SWAP_ICON, index: 0})}/>
                <Button icon="download" style={{margin: "auto 2px"}}
                  onClick={()=> downloadElement({imghash: SWAP_ICON, index: 0, defaultPath: "swap_icon-0.png"})}/>
              </div>
            </div>
          }
          <p><strong>贴图</strong></p>
          <div style={{display: "inline-block", border: "1px solid #ddd", borderRadius: 2, marginBottom: 20}}>
            <table className={style["list-container"]}>
              <thead>
                <th>索引</th>
                <th>文件名</th>
                <th>图片</th>
                <th>操作</th>
              </thead>
              <tbody>
                {
                  build.atlas.map((name, i)=> 
                    <tr key={i}>
                      <td>{i}</td>
                      <td className='bp4-monospace-text'>{name}</td>
                      <td>
                        <Preview.Atlas 
                          build={build.name} sampler={i} 
                          lazy={false}
                          onCreateImageBitmap={m=> setAtlas(atlas=> ({...atlas, [i]: m}))}/>
                      </td>
                      <td>
                        <Button icon="duplicate" onClick={()=> copyAtlas({sampler: i})}/>
                        <span style={{display: "inline-block", width: 10}}/>
                        <Button icon="download" onClick={()=> downloadAtlas({sampler: i, defaultPath: name})}></Button>
                      </td>
                    </tr>)
                }
              </tbody>
            </table>
          </div>
          <p><strong>元件</strong></p>
          <p>
            <BatchDownloadButton type="build" file={file}/>
          </p>
          <div style={{display: "inline-block", border: "1px solid #ddd", borderRadius: 2, marginBottom: 20}}>
            <div className={style["symbol-list"]}>
              {
                build.symbol.map(({imghash, imglist}, index: number)=> {
                  const unfold = unfoldSymbol[imghash]
                  return <div className={style["symbol-container"] + " " + (!unfold ? style["symbol-container-hoverable"]: "" )} key={index}>
                    <H6 className={"can-select"}
                      onClick={()=> setUnFoldSymbol({...unfoldSymbol, [imghash]: !unfold})}>
                      <Icon style={{marginRight: 0}} icon={unfold ? "caret-down" : "caret-right"} size={16}/>
                      <Hash hash={imghash}/>
                      <Tag style={{marginLeft: 8}} minimal>{imglist.length}</Tag>
                    </H6>
                    <div
                      className={style["element-list"]} 
                      style={{display: unfold ? "none" : undefined}}>
                      {
                        imglist.map(element=> 
                        <Popover2 minimal
                          placement="top-start"
                          content={<div className={style["element-op"]}>
                            <H6><Hash hash={imghash}/>-{element.index}</H6>
                            <Button icon="duplicate" onClick={()=> copyElement({imghash, index: element.index})}>
                              
                            </Button>
                            {/* <br/> */}
                            <Button icon="download" style={{marginLeft: 4}}
                              onClick={()=> downloadElement({imghash, index: element.index,
                                defaultPath: (window.hash.get(imghash) || `Hash-${imghash}`) + `-${element.index}.png`})}>
                              
                            </Button>
                          </div>}>
                          <div className={style["element"]} key={`${imghash}-${element.index}`}>
                            <Preview.SymbolElement atlas={atlas} data={element} width={40} height={40}/>
                          </div>
                        </Popover2>)
                      }
                    </div>
                    <div 
                      className={style["element-detailed-list"]}
                      style={{display: unfold ? undefined : "none"}}>
                      <table>
                        <thead></thead>
                        <tbody>
                          {
                            imglist.map(element=> <tr>
                              <td className='can-select'>
                                <Hash hash={imghash}/>-{element.index}
                              </td>
                              <td>
                                {formatElementSize(element, atlas)}
                              </td>
                              <td>
                                <Preview.SymbolElement atlas={atlas} data={element} width={40} height={40}/>
                              </td>
                              <td>
                                <Button icon="duplicate" style={{marginRight: 8}} onClick={()=> copyElement({imghash, index: element.index})}/>
                                <Button icon="download"
                                  onClick={()=> downloadElement({imghash, index: element.index,
                                    defaultPath: (window.hash.get(imghash) || `Hash-${imghash}`) + `-${element.index}.png`})}/>
                              </td>
                            </tr>)
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                })
              }
            </div>
          </div>
        </> :
        <></>
      }
      <H5>动画 <ClickableTag term="animation"/></H5>
      {
        animList === false ? "本资源包内不包含动画。" :
        animList !== undefined ? <div style={{display: "inline-block", border: "1px solid #ddd", borderRadius: 2, marginBottom: 20}}>
          <table className={style["list-container"]}>
            <thead>
              <th>动画库</th>
              <th>名字</th>
              <th>朝向</th>
              <th>帧数
                <Tooltip2 placement="right" content={"30帧 = 1秒"}>
                  <Button icon="help" minimal small
                    style={{marginTop: -4, marginBottom: -2}} />
                </Tooltip2>
              </th>
            </thead>
            <tbody>
            {
              animList.map(({name, facing, bankhash, numframes})=> 
              <tr>
                <td className='bp4-monospace-text'>
                  <Hash hash={bankhash}/>
                </td>
                <td className='bp4-monospace-text'>
                  {name}
                </td>
                <td>
                  <FacingString facing={facing}/>
                </td>
                <td>{numframes}</td>
              </tr>
              )
            }
            </tbody>
          </table>
        </div>:
        <></>
      }
    </div>
  </div>
}

type FevRefFileList = Array<{
  fsb_name: string,
  lengthms: number,
  path: string,
  file_index: number,
  file_info: {
    channels: 1 | 2,
    data_size: number,
    default_name: string,
    fsb_name: string,
    name: string,
    frequency: number,
    samplers: number,
  }
}>

function FmodEventPage(props: FmodEvent) {
  const {id, path, project, lengthms, category, param_list} = props
  const typeStr = useMemo(()=> {
    if (category.startsWith("master/set_sfx/"))
      return "音效" 
    else if (category.startsWith("master/set_music/"))
      return "音乐"
    else if (category.startsWith("master/set_ambience/"))
      return "环境声"
    else
      return category
  }, [category])
  const lengthStr = useMemo(()=> {
    if (lengthms < 0) {
      return "无限循环"
    }
    else if (lengthms < 1000) {
      return `${lengthms}毫秒`
    }
    else {
      return `${(lengthms/1000).toFixed(2)}秒`
    }
  }, [lengthms])
  const paramList = useMemo(()=> {
    if (param_list.length === 0)
      return "无"
    else 
      return param_list.map(({name})=> name).join(" / ")
  }, [param_list])

  const [refData, setRefData] = useState<FevRefFileList>(undefined)
  useLuaCallOnce<string>("load", response=> {
    const data = JSON.parse(response)
    if (data.has_sounddef){
      setRefData(data.file_list)
    }
    else{
      setRefData([])
    }
  },
    { type: "fev_ref", path }, [path])

  return (
    <div>
      <H3>{path} <AssetType type={"fmodevent"}/></H3>
      {
        lengthms === 0 || Array.isArray(refData) && refData.length === 0 ? 
        <Callout intent='danger' style={{paddingBottom: 5, marginBottom: 10, marginTop: 20}}>
          <p>
            这是一个未使用任何音频素材的空音效，无法播放和导出。
          </p>
        </Callout> : <SfxPlayer {...props}/>
      }
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <div style={{height: 10}}/>
      <H5>基本信息</H5>
      <p>分类：{typeStr}</p>
      <p>时长：{lengthStr}</p>
      <p>参数：{paramList}</p>
      <AssetFilePath type="fev_link" path={project}/>
      <br/>
      <H5>音频文件</H5>
      {
        Array.isArray(refData) ?
        <div>
          <SoundRefList path={path} data={refData}/>
        </div> :
        <div style={{width: 50}}>
          <Spinner size={40}/>
        </div>
      }
    </div>
  )
}

function SoundRefList(props: {data: FevRefFileList, path: string}) {
  const {data, path} = props
  if (data.length === 0)
    return <p>什么都没有 ¯\_(ツ)_/¯ </p>

  const formatLength = useCallback((lengthms: number)=> {
    if (lengthms < 1000) {
      return `${lengthms}毫秒`
    }
    else {
      return `${(lengthms/1000).toFixed(2)}秒`
    }
  }, [])

  const formatFileSize = useCallback((size: number)=> {
    if (size < 1024) {
      return `${size} b`
    }
    else if (size < 1024* 1024) {
      return `${(size/1024).toFixed(2)} Kb`
    }
    else {
      return `${(size/1024/1024).toFixed(2)} Mb`
    }
  }, [])

  const success = useCopySuccess("path")
  const showFsb = useLuaCall<string>("load", ()=> {}, {type: "show"})

  return (
    <>
      本音效引用了{data.length}个音频文件。
      {/* <Button icon="download" onClick={()=> download()}>批量导出</Button> */}
      <BatchDownloadButton type="fev_ref" path={path}/>
      <table className={style["fev-ref-table"]}>
        <thead>
          <th>文件名</th>
          <th>时长</th>
          {/* <th>文件大小</th> */}
          <th>采样率</th>
          <th>声道</th>
          <th>包名</th>
          <th>导出</th>
        </thead>
        <tbody>
          {
            data.map((v, i)=> <tr key={i}>
              <td className={style["table-name"]}>{v.file_info.name}</td>
              <td>{formatLength(v.lengthms)}</td>
              {/* <td>{formatFileSize(v.file_info.data_size)}</td> */}
              <td>{`${v.file_info.frequency} Hz`}</td>
              <td>{v.file_info.channels === 1 ? "单声道" : "双声道"}</td>
              <td>
                <Popover2 
                  minimal
                  placement="top-start"
                  content={<Menu>
                    <MenuItem text="拷贝路径" icon="duplicate" 
                      onClick={()=> writeText(`sound/${v.fsb_name}.fsb`).then(()=> success())}/>
                    <MenuItem text="打开文件位置" icon="folder-open"
                      onClick={()=> showFsb({file: `sound/${v.fsb_name}.fsb`})}/>
                  </Menu>}>
                    <a>{v.fsb_name}.fsb</a>
                </Popover2>
              </td>
              <td>
                <BatchDownloadButton type="fev_ref" path={path} text={""} file_index={i}/>
              </td>
            </tr>)
          }
        </tbody>
      </table>
    </>
  )
}

function FmodProjectPage(props: FmodProject) {
  const {file, name} = props

  useEffect(()=> {
    // listen for page cache
    let unlisten = appWindow.listen<any>("unmount_cache", ({payload: {cacheId}})=> {
      if (cacheId.startsWith("assetPage")) {
        killPreviewSfx()
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  const [filterResult, setFilterResult] = useState<any[]>()

  const allEventList = useMemo(()=> {
    return window.assets.allfmodevent
      .filter(v=> v.project_name === name)
      .sort((a, b)=> a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1)
  }, [name, filterResult])

  const filterEventList = useMemo(()=> {
    return Array.isArray(filterResult) && 
      filterResult
        .filter(v=> v.project_name === name)
        .sort((a, b)=> a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1)
  }, [name, filterResult])

  const hasFilter = Array.isArray(filterEventList)

  const onFilterChange = useCallback((query: string)=> {
    query = query.trim()
    if (!query) {
      setFilterResult(undefined)
      return
    }
    else {
      search("assets", query, {
        filter: "type = fmodevent",
        limit: 1000, 
        showMatchesPosition: true
      }).then(result=> {
        if (result.query !== query) return
          setFilterResult(result.hits
            .map(({id, _matchesPosition})=> {
              return {
                matches: _matchesPosition,
                ...window.assets_map[id]
              }
            })
          )
        }
      )
    }
  }, [name])

  return (
    <div>
      <H3>{file}<AssetType type="fmodproject"/></H3>
      {/* <H5>描述</H5>
      <AssetDesc id={id}/> */}
      <H5>列表</H5>
      <p>
        总共包含{allEventList.length}个音效。
        {
          hasFilter && 
          `筛选出${filterEventList.length}个音效。`
        }
      </p>
      <InputGroup 
        placeholder="筛选"
        spellCheck="false"
        autoComplete="off" 
        leftIcon="filter"
        small
        style={{maxWidth: 200}}
        onChange={e=> onFilterChange(e.currentTarget.value)}
      />
      <hr/>
      {
        (hasFilter ? filterEventList : allEventList)
          .map(v=> <AccessableItem key={v.id} {...v}/>)
      }
      <H5>基本信息</H5>
      <AssetFilePath type="fev" path={name}/>
    </div>
  )
}

function ShaderPage(props: Shader) {
  const {id, file, _vs, _ps} = props
  const success = useCopySuccess("code")
  return (
    <div>
      <H3>{file}<AssetType type="shader"/></H3>
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <div style={{height: 10}}></div>
      <H5>Vertex Shader 
        <Button minimal icon="duplicate" onClick={()=> writeText(_vs).then(success)}/>
      </H5>
      <Code src={_vs} language='glsl'/>
      <H5>Fragment Shader 
        <Button minimal icon="duplicate" onClick={()=> writeText(_ps).then(success)}/>
      </H5>
      <Code src={_ps} language='glsl'/>
    </div>
  )
}

type AssetInvalidPageProps = {
  type: "null" | "waiting" | "invalid-id" | "invalid-type",
  typeName?: any,
  id?: string,
  forceUpdate?: ()=> void,
}

function AssetInvalidPage(props: AssetInvalidPageProps) {
  const {type, typeName, id, forceUpdate} = props
  const navigate = useNavigate()  
  useEffect(()=> {
    const token = setInterval(()=> {
      if (type === "waiting"){
        forceUpdate()
      }
    }, 500)
    return ()=> clearInterval(token)
  }, [type])

  if (type === "waiting"){
    return <NonIdealState title="正在加载" layout='vertical'>
      <Spinner/>
      <Button onClick={()=> forceUpdate()}>刷新</Button>
    </NonIdealState>
  }
  else{
    return <div style={{marginTop: 30}}>
      <NonIdealState title="加载失败" icon="search" layout="vertical"
        description={
        <div>
          {
            type === "invalid-id" && 
            <p>{"错误信息: 资源地址无效" + 
              (id === "null" ? "（id = null）" : `（${id}）`)}
            </p>
          }
          {
            type === "invalid-type" && 
            <p>{"错误信息: 资源类型无效（type = " + typeName + "）"}</p>
          }
          <p>这是一个bug，不应该出现这个页面！</p>
          <hr/>
          <Button icon="envelope" onClick={()=> navigate("/report-bug")}>反馈</Button>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <Button onClick={()=> navigate("/home")}>回到首页</Button>
        </div>}
      />
    </div>
  }
}