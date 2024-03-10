import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { H3, H5, H6, Icon, NonIdealState, Button, Spinner, Menu, MenuItem, Callout, InputGroup, Tag, RadioGroup, Radio, Checkbox } from '@blueprintjs/core'
import { ButtonGroup } from '@blueprintjs/core'
import { useLuaCall, useCopyTexElement, useCopyBuildAtlas, useCopySymbolElement, useCopySuccess, useSaveFileCall, useCopyTexture, useLuaCallOnce, useLocalStorage, usePagingHandler } from '../../hooks'
import { appWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/api/clipboard'
import style from './index.module.css'
import Preview, { killPreviewSfx } from '../../components/Preview'
import ClickableTag from '../../components/ClickableTag'
import Hash, { useHashToString } from '../../components/HumanHash'
import FacingString from '../../components/FacingString'
import CCMiniPlayground from '../../components/CCMiniPlayground'
import KeepAlivePage, { KeepAlivePageProps } from '../../components/KeepAlive/KeepAlivePage'
import AtlasUVMapViewer from '../../components/AtlasUVMapViewer'
import AssetFilePath from '../../components/AssetFilepath'
import BatchDownloadButton from '../../components/BatchDownloadButton'
import { ArchiveItem, Entry, FmodEvent, FmodProject, Shader } from '../../searchengine'
import SfxPlayer from '../../components/SfxPlayer'
import { AccessableItem } from '../../components/AccessableItem'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import Code from '../../components/Code'
import AssetDesc from '../../components/AssetDesc'
import { addDocuments, search } from '../../global_meilisearch'
import AnimQuickLook from '../../components/AnimQuickLook'
import { formatAlias, sortedAlias } from '../../components/AliasTitle'
import { byte2facing } from '../../facing'
import PopoverMenu from '../../components/PopoverMenu'
import smallhash from '../../smallhash'
import SortableField from '../../components/SortableField'
import store, { useSelector } from '../../redux/store'
import { invoke } from '@tauri-apps/api'
import PageTurner from '../../components/PageTurner'
import TinySlider from '../../components/TinySlider'

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
    case "e": return "entry"
    case "b": return id.startsWith("bank-") ? "allbank" : "unknown"
  }
  throw Error("Failed to get type key: " + id)
}

export default function AssetPage() {
  const [param] = useSearchParams()
  const id = param.get("id")
  const [_, forceUpdate] = useReducer(v=> v + 1, 0)
  if (id === null || id === "undefined") return <AssetInvalidPage type="null"/>
  const asset = window.assets_map[id]
  if (!asset) {
    if (!window.assets[getTypeKeyById(id)]){
      return <AssetInvalidPage type="waiting" forceUpdate={forceUpdate}/>
    }
    else{
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
      return <KeepAlive key={id}>
        <ShaderPage {...asset} key={id}/>
      </KeepAlive>
    case "fmodevent":
      return <FmodEventPage {...asset} key={id}/>
    case "fmodproject":
      return <KeepAlive key={id}>
        <FmodProjectPage {...asset} key={id}/>
      </KeepAlive>
    case "entry":
      return <KeepAlive key={id}>
        <EntryPage {...asset} key={id}/>
      </KeepAlive>
    case "bank":
      return <KeepAlive key={id}>
        <BankPage key={id} bank={Number(id.substring(("bank-".length)))}/>
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
  const [isMaximized, setMaximized] = useLocalStorage("tex_maximized")
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
    setMaximized(!isMaximized)
  }, [isMaximized, setMaximized])

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
  const [isMaximized, setMaximized] = useLocalStorage("tex_maximized")
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
        onClick={()=> setMaximized(!isMaximized)}/>
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
      <AssetFilePath type="tex" path={file}/>
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
  const [display, setDisplay] = useLocalStorage("xml_display_mode")
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

  const navigate = useNavigate()
  const hashToString = useHashToString()

  useLuaCallOnce<string>("load", result=> {
    if (result === "false") {
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
    if (result === "[]") {
      // `anim.bin` not exists
      setAnimList(false)
    }
    else {
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

  const buildName = build && build.name
  const guessBankNames = useMemo(()=> {
    const result = []
    Object.entries(window.animpreset.auto).forEach(([k, v])=> {
      if (v.indexOf(buildName) !== -1)
        // @ts-ignore
        result.push(Number(k))
    })
    console.log(result)
    return result
  }, [buildName])

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
                <Preview.FastSymbolElement atlas={atlas} data={swap_icon} width={50} height={50}/>
                <div style={{width: 10}}/>
                <Button icon="duplicate" style={{margin: "auto 2px"}} 
                  onClick={()=> copyElement({imghash: SWAP_ICON, index: 0})}/>
                <Button icon="download" style={{margin: "auto 2px"}}
                  onClick={()=> downloadElement({imghash: SWAP_ICON, index: 0, defaultPath: "swap_icon-0.png"})}/>
              </div>
            </div>
          }
          {
            build.atlas.length === 0 ?
            <div>
              <Callout intent='danger' style={{paddingBottom: 5, marginBottom: 20, marginTop: 5}}>
                <p>
                  这是一个无效的材质，不包含任何贴图。
                </p>
              </Callout>
            </div> :
            <>
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
                                <Preview.FastSymbolElement atlas={atlas} data={element} width={40} height={40}/>
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
                                    <Preview.FastSymbolElement atlas={atlas} data={element} width={40} height={40}/>
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
            </>
          }
        </> :
        <></>
      }
      <H5>动画 <ClickableTag term="animation"/></H5>
      {
        animList === false ? <>
          <p>本资源包内不包含动画。</p>
          {
            guessBankNames.length > 0 && <p>
              这些动画库可能与之相关：
              {guessBankNames.map(v=> <Hash key={v} hash={v}/>)}
            </p>
          }
        </> :
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
              <th>预览</th>
            </thead>
            <tbody>
            {
              animList.map(({name, facing, bankhash, numframes})=> {
              const reposition = {} as any
              return <tr>
                <td>
                  <PopoverMenu menu={[
                    {text: "拷贝库名", icon: "duplicate", copyText: hashToString(bankhash)},
                    {text: "查看动画库详情", icon: "link", directURL: "/asset?id=bank-"+bankhash}
                  ]}>
                    <Hash hash={bankhash}/>
                  </PopoverMenu>
                </td>
                <td>
                  <PopoverMenu menu={[
                    {text: "拷贝动画名", icon: "duplicate", copyText: name}
                  ]}>
                    {name}
                  </PopoverMenu>
                </td>
                <td>
                  <FacingString facing={facing}/>
                </td>
                <td>{numframes}</td>
                <td>
                  <Popover2 interactionKind="hover"
                    placement="right"
                    ref={v=> reposition.fn = ()=> { v?.reposition() }}
                    content={<div style={{padding: 5}}>
                      <AnimQuickLook 
                        bankhash={bankhash} 
                        animation={name} 
                        build={buildName} 
                        facing={facing}
                        onResize={()=> reposition.fn?.()}
                      />
                    </div>}>
                    <Button icon="eye-open" />
                  </Popover2>
                </td>
              </tr>}
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

enum CategoryPrefix {
  SFX = "master/set_sfx/",
  MUSIC = "master/set_music/",
  AMB = "master/set_ambience/",
}

const formatSoundCategory = (category: string)=> {
  if (category.startsWith(CategoryPrefix.SFX))
    return "音效" 
  else if (category.startsWith(CategoryPrefix.MUSIC))
    return "音乐"
  else if (category.startsWith(CategoryPrefix.AMB))
    return "环境声"
  else
    return category
}

const formatSoundLength = (lengthms: number)=> {
  if (lengthms < 0) {
    return "无限循环"
  }
  else if (lengthms < 1000) {
    return `${lengthms}毫秒`
  }
  else {
    return `${(lengthms/1000).toFixed(2)}秒`
  }
}

function FmodEventPage(props: FmodEvent) {
  const {id, path, project, lengthms, category, param_list} = props
  const typeStr = formatSoundCategory(category)
  const lengthStr = formatSoundLength(lengthms)
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

  if (data.length === 0)
    return <p>什么都没有 ¯\_(ツ)_/¯ </p>

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

  const [query, setQuery] = useState("")
  const [queryResult, setQueryResult] = useState<{[path: string]: boolean}>({all: true})

  const allEventList = useMemo(()=> {
    return window.assets.allfmodevent
      .filter(v=> v.project_name === name)
      .sort((a, b)=> a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1)
  }, [name])

  useEffect(()=> {
    if (!query.trim()) {
      setQueryResult({all: true})
      return
    }
    search("assets", query, {
      filter: "type = fmodevent",
      limit: 1000, 
      showMatchesPosition: true
    }).then(response=> {
      if (response.query !== query) return
      const result = {}
      console.log(response.hits)
      response.hits.forEach(({fmodpath})=> result[fmodpath] = true)
      setQueryResult(result)
    })
  }, [query])

  const [abstract, setAbstract] = useState<{
    [path: string]: {has_sounddef: boolean},
  }>({})

  useLuaCallOnce<string>("load", response=> {
    const data = JSON.parse(response) as typeof abstract
    setAbstract(data)
  }, {type: "fev_abstract", path: file}, [file])

  const numEmpty = useMemo(()=> {
    return Object.values(abstract)
      .filter(v=> !v.has_sounddef)
      .length
  }, [abstract])

  const [filter, setFilter] = useLocalStorage("fev_filter_strategy")
  const [sort, setSort] = useLocalStorage("fev_sort_strategy")
  const noEmpty = filter.indexOf("-empty") !== -1

  const [items, numFiltered] = useMemo(()=> {
    let list: typeof allEventList = []
    let numFiltered = 0
    if (noEmpty) {
      list = allEventList.filter(v=> abstract[v.path] && abstract[v.path].has_sounddef)
      numFiltered = allEventList.length - list.length
      console.log(list.length)
    }
    else {
      list = allEventList
    }
    if (!queryResult.all) {
      list = list.filter(({path})=> queryResult[path])
    }
    return [list, numFiltered]
  }, [noEmpty, abstract, queryResult, allEventList])

  const sortedItems = useMemo(()=> items.toSorted((a, b)=> {
    for (let s of sort) {
      let prefix = "" // test prefix for category
      let loopIs = Infinity // always place loop to bottom, unless sort by `len.loop`
      switch (s) {
        case "path.a-z":
        case "path.z-a":
          if (a.path !== b.path)
            return (a.path < b.path) === (s === "path.a-z") ? -1 : 1
        
        case "category.amb":
          prefix = prefix || CategoryPrefix.AMB
        case "category.music":
          prefix = prefix || CategoryPrefix.MUSIC
        case "category.sfx":
          prefix = prefix || CategoryPrefix.SFX
          const ac = a.category.startsWith(prefix)
          const bc = b.category.startsWith(prefix)
          if (ac !== bc)
            return ac ? -1 : 1
        
        case "len.loop":
        case "len.9-0":
          loopIs = -1
        case "len.0-9":
          const al = a.lengthms < 0 ? loopIs : a.lengthms
          const bl = b.lengthms < 0 ? loopIs : b.lengthms
          if (al !== bl)
            return (al < bl) === (s === "len.0-9" || s === "len.loop") ? -1 : 1

        case "no-param":
          const anp = a.param_list.length === 0
          const bnp = b.param_list.length === 0
          if (anp !== bnp)
            return anp ? -1 : 1
        default:
          // param-xxxxx
          const ap = Boolean(a.param_list.find(({name})=> `param-${name}` === s))
          const bp = Boolean(b.param_list.find(({name})=> `param-${name}` === s))
          if (ap !== bp)
            return ap ? -1 : 1
      }
    }
    return 0
  }), [items, sort])

  // collect sort data
  const sortData = useMemo(()=> {
    const data = {
      hasLoop: false,
      hasSfx: false,
      hasMusic: false,
      hasAmb: false,
      hasEmpty: false,
      hasNoParam: false,
      paramNames: [] as string[],
    }
    const paramNames = new Set<string>()
    items.forEach(({lengthms, category, path, param_list})=> {
      if (lengthms < 0)
        data["hasLoop"] = true
      if (!data["hasSfx"] && category.startsWith(CategoryPrefix.SFX))
        data["hasSfx"] = true
      if (!data["hasMusic"] && category.startsWith(CategoryPrefix.MUSIC))
        data["hasMusic"] = true
      if (!data["hasAmb"] && category.startsWith(CategoryPrefix.AMB))
        data["hasAmb"] = true
      if (abstract && abstract[path] && !abstract[path].has_sounddef)
        data["hasEmpty"] = true
      if (param_list.length > 0)
        param_list.forEach(({name})=> paramNames.add(name))
      else
        data["hasNoParam"] = true
    })
    data.paramNames = [...paramNames].toSorted()
    return data
  }, [items, abstract])
  
  const resetScroll = useCallback(()=> {
    document.getElementById("app-article").scrollTop = 1
  }, [])
  const handler = usePagingHandler(items, {resetScroll})
  const {range, first} = handler

  const onChangeSort = useCallback((e: React.FormEvent<HTMLInputElement>)=> {
    const value = e.currentTarget.value
    setSort([value, ...sort.filter(v=> v !== value)])
    first()
  }, [sort, setSort, first])

  return (
    <div>
      <H3>{file}<AssetType type="fmodproject"/></H3>
      {/* <H5>描述</H5>
      <AssetDesc id={id}/> */}
      <p>
        总共包含{allEventList.length}个音效。
        {
          numFiltered > 0 &&
          <span style={{color: "#999"}}>（{numFiltered}个被隐藏）</span>
        }
      </p>
      <div style={{display: "flex", alignContent: "center", marginBottom: 10}}>
        <InputGroup 
          placeholder="筛选"
          spellCheck="false"
          autoComplete="off" 
          leftIcon="filter"
          small
          style={{maxWidth: 200}}
          value={query}
          onChange={e=> setQuery(e.currentTarget.value)}
        />
        <Checkbox 
          style={{marginLeft: 10, marginTop: 4}}
          checked={filter.indexOf("-empty") !== -1}
          onChange={e=> setFilter(e.currentTarget.checked ? ["-empty"] : [])}>
          隐藏空音效（{numEmpty}）
        </Checkbox>
      </div>
      <table className={style["compact-table"] + " bp4-html-table"}>
        <thead>
          <th>
            <SortableField
              text="路径"
              selectedValue={sort[0]}
              onChange={onChangeSort}
              choices={[
                {label: "按路径排序（a-z）", value: "path.a-z"},
                {label: "按路径排序（z-a）", value: "path.z-a"},
              ]}
            />
          </th>
          <th>
            <SortableField
              text="分类"
              selectedValue={sort[0]}
              onChange={onChangeSort}
              choices={[
                {label: `将${formatSoundCategory(CategoryPrefix.SFX)}置顶`, 
                  visible: sortData["hasSfx"], value: "category.sfx"},
                {label: `将${formatSoundCategory(CategoryPrefix.MUSIC)}置顶`, 
                  visible: sortData["hasMusic"], value: "category.music"},
                {label: `将${formatSoundCategory(CategoryPrefix.AMB)}置顶`, 
                  visible: sortData["hasAmb"], value: "category.amb"},
              ]}
            />
          </th>
          <th>
            <SortableField
              text="时长"
              selectedValue={sort[0]}
              onChange={onChangeSort}
              choices={[
                {label: `按时长排序（小到大）`, value: "len.0-9"},
                {label: `按时长排序（大到小）`, value: "len.9-0"},
                {label: `将${formatSoundLength(-1)}置顶`, visible: sortData["hasLoop"], value: "len.loop"},
              ]}
            />
          </th>
          <th>播放 <Button minimal disabled style={{cursor: "default"}}/> </th>
          <th>
            <SortableField
              text="参数"
              selectedValue={sort[0]}
              onChange={onChangeSort}
              choices={[
                {label: `将无参数置顶`, visible: sortData["hasNoParam"], value: "no-param"},
                ...sortData.paramNames.map(name=> ({
                  label: `将含有${name}参数置顶`, value: `param-${name}`
                }))
              ]}
            />
          </th>
        </thead>
        <tbody>
          {
            sortedItems.map((v, i)=> 
            i >= range[0] && i <= range[1] &&
            <tr key={v.path}>
              <td className={style["sound-path"]}>
                <PopoverMenu menu={
                  [
                    {icon: "duplicate", text: "拷贝路径", copyText: v.path},
                    {icon: "link", text: "查看详情",
                      directURL: "/asset?id=f-"+smallhash(v.path)}
                  ]
                }>
                  {v.path}
                </PopoverMenu>
              </td>
              <td>{formatSoundCategory(v.category)}</td>
              <td>{formatSoundLength(v.lengthms)}</td>
              <td>
                <PlayIcon path={v.path} param_list={v.param_list}/>
              </td>
              <td>
                {v.param_list.length === 0 && "-"}
                {v.param_list.map(({name, range})=> 
                  <ParamSlider name={name} range={range}/>)}
              </td>
            </tr>)
          }
        </tbody>
      </table>
      <PageTurner {...handler} style={{marginTop: 10, marginBottom: 40}}/>
      <H5>基本信息</H5>
      <AssetFilePath type="fev" path={name}/>
      <div style={{height: 50}}/>
    </div>
  )
}
// TODO: 轮播模式

function PlayIcon(props: {path: string, param_list: FmodEvent["param_list"]}) {
  const SFX_ID = "PREVIEW_SFX"
  const {path, param_list} = props
  const isPlaying = useSelector(({appstates})=> 
    (appstates.fmod_playing_info[SFX_ID] || {}).playing)
  const playingPath = useSelector(({appstates})=> 
    (appstates.fmod_playing_info[SFX_ID] || {}).path)
  const [fmod_param_value] = useLocalStorage("fmod_param_value")
  const play = useCallback(()=> {
    // don't use `useSelector` for performance issue
    const params = Object.fromEntries(
      param_list.map(({name, range})=> {
        const percent = fmod_param_value[name] || 0
        return [name, range[0] + (range[1]-range[0])*percent]
      })
    )
    invoke("fmod_send_message", {data: JSON.stringify({
      api: "PlaySoundWithParams",
      args: [path, SFX_ID, params],
    })})
  }, [path, param_list, fmod_param_value])
  const stop = useCallback(()=> {
    invoke("fmod_send_message", {data: JSON.stringify({
      api: "KillSound",
      args: [SFX_ID],
    })})
  }, [])
  const onClick = useCallback((e: React.MouseEvent)=> {
    if (isPlaying) {
      stop()
      if (playingPath !== path) {
        play()
      }
    }
    else {
      play()
    }
    e.stopPropagation()
  }, [play, stop, isPlaying, playingPath, path])
  return (
    <Button
      icon={isPlaying && playingPath === path ? "stop" : "play"} 
      intent={isPlaying && playingPath === path ? "primary" : "none"}
      onClick={onClick}/>
  )
}

function ParamSlider(props: {name: string, range: [number, number]}) {
  const {name, range} = props
  const [fmod_param_value, setParam] = useLocalStorage("fmod_param_value")
  const {[name]: percent = 0.5} = fmod_param_value
  const SFX_ID = "PREVIEW_SFX"

  const onChange = useCallback((percent: number)=> {
    const value = range[0] + (range[1]-range[0])* percent
    setParam({...fmod_param_value, [name]: percent})
    invoke("fmod_send_message", { data: JSON.stringify({
      api: "SetParameter",
      args: [SFX_ID, name, value],
    })})
  }, [name, range, fmod_param_value, setParam])
  return (
    <Popover2 minimal placement="top" 
      content={<div style={{width: 100}}>
        <TinySlider min={0} max={1} stepSize={0.01}
          value={percent}
          onChange={onChange}/>
      </div>}>
      <Tag key={name} minimal interactive style={{marginBottom: 3}}>
        {name}
      </Tag>
    </Popover2>
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

const codeStyle: React.CSSProperties = {
  color: "#999",
  fontWeight: 400,
  fontSize: ".85em",
}

function EntryPage(props: Entry) {
  const {assets, id, deps, source} = props
  const alias = useMemo(()=> {
    return sortedAlias(props.alias)
  }, [props.alias])

  return (
    <div>
      <H3>
        {
          alias.map((v, i)=> 
          <span key={i} style={{
            display: "inline-block",
            marginRight: 4,
            ...(i > 0 && codeStyle),
          }}>
            {v}
          </span>)
        }
      </H3>
      <H5>描述</H5>
      <AssetDesc id={id}/>
      <div style={{height: 10}}></div>
      <H5>资源文件</H5>
      {
        assets.length > 0 ?
        <div className={style["entry-asset-list"]}>
        {
          assets.map(({id})=> 
            window.assets_map[id] &&
            <AccessableItem key={id} {...window.assets_map[id]}/>)
        }
        </div> :
        <p>该词条未引用任何文件。</p>
      }
      {
        source.length > 0 &&
        <>
          <H5>源代码文件</H5>
          {
            source.map(v=> <AssetFilePath key={v} type="source" path={v}/>)
          }
        </>
      }
    </div>
  )
}

type BankPageProps = {
  bank: number,
}

const DUMMY_ANIMATION_LIST = [...Array(4).keys()].map((i)=> ({
  id: "dummy" + i,
  name: "dummy_animation",
  numframes: 0,
  framerate: 30,
  facing: 0,
  assetpath: "anim/dummy.zip",
}))

function BankPage(props: BankPageProps) {
  const {bank} = props
  const hashToString = useHashToString()
  const bankName = hashToString(bank)
  const bankName_Hash = `HASH-${bank}`
  const resolved = typeof bankName === "string"

  const [animationList, setList] = useState<
    // idle_loop    34   255   [30]    anim/player_idles.zip
    // ext: is_pre is_pst is_lag
    {name: string, numframes: number, framerate: number, facing: number, assetpath: string,
      isPre?: boolean, isPst?: boolean, isLag?: boolean, id?: string}[]
  >(DUMMY_ANIMATION_LIST)

  useLuaCallOnce<string>("load", response=> {
    const list = JSON.parse(response) as typeof animationList
    list.forEach(v=> {
      v.isPre = v.name.endsWith("_pre")
      v.isPst = v.name.endsWith("_pst")
      v.isLag = v.name.endsWith("_lag")
    })
    setList(list)
    // push animation list to search engine
    addDocuments("anims", list.map(({id, name, facing, assetpath})=> 
      ({ id, bank, name, facing, assetpath}))
    )
  }, {type: "bank", bank}, [bank])

  const [sort, setSort] = useLocalStorage("bank_sort_strategy")
  const [filter, setFilter] = useLocalStorage("bank_filter_strategy")

  const [query, onChangeQuery] = useState("")
  const [queryResult, setQueryResult] = useState<{[id: string]: boolean}>({})
  const hasQuery = query.trim().length > 0

  const setFirstElementInList = useCallback((value: string, list: string[])=> 
    [value, ...list.filter(v=> v !== value)]
  , [])

  const facingList = useMemo(()=> {
    const facings = new Set<number>()
    animationList.forEach(v=> facings.add(v.facing))
    return [...facings].toSorted((a, b)=> a - b)
  }, [animationList])

  const noPrePst = filter.indexOf("-pre/pst") !== -1
  const noLag = filter.indexOf("-lag") !== -1

  const filterCounts = useMemo(()=> {
    const counts = {
      // ["-pre"]: 0,
      // ["-pst"]: 0,
      ["-pre/pst"]: 0,
      ["-lag"]: 0,
    }
    animationList.forEach(({isPre, isPst, isLag})=> {
      if (isPre || isPst)
        counts["-pre/pst"]++
      if (isLag)
        counts["-lag"]++
    })
    return counts
  }, [animationList])

  const filteredAnimationList = useMemo(()=> {
    return animationList.filter(({isPre, isLag, isPst})=> {
      if (noPrePst && (isPre|| isPst))
        return false
      if (noLag && isLag)
        return false

      return true
    })
  }, [animationList, noPrePst, noLag])

  const numFiltered = animationList.length - filteredAnimationList.length

  const queryAnimationList = useMemo(()=> {
    return filteredAnimationList.filter(({id})=> 
      !hasQuery || queryResult[id] 
    )
  }, [hasQuery, queryResult, filteredAnimationList])

  const sortedAnimationList = useMemo(()=> {
    return queryAnimationList.toSorted((a, b)=> {
      // check sort rule from start to end
      for (let s of sort) {
        switch (s) {
          case "name.a-z":
          case "name.z-a":
            if (a.name !== b.name)
              return (s === "name.a-z") === (a.name < b.name) ? -1 : 1
          case "path.a-z":
          case "path.z-a":
            if (a.assetpath !== b.assetpath)
              return (s === "path.a-z") === (a.assetpath < b.assetpath) ? -1: 1
          case "0-9":
          case "9-0":
            if (a.numframes !== b.numframes)
              return (s === "0-9") === (a.numframes < b.numframes) ? -1 : 1
          default:
            const a_top = s === `facing-${a.facing}`
            const b_top = s === `facing-${b.facing}`
            if (a_top !== b_top)
              return a_top ? -1 : 1
            else if (a.facing !== b.facing)
              return a.facing - b.facing
        }
      }
      return 0
    })
  }, [queryAnimationList, sort])

  const isLoading = animationList === DUMMY_ANIMATION_LIST

  const resetScroll = useCallback(()=> {
    document.getElementById("app-article").scrollTop = 1
  }, [])

  const handler = usePagingHandler(sortedAnimationList, {resetScroll})
  const {first, range} = handler
  const onChangeSort = useCallback((e: React.FormEvent<HTMLInputElement>)=> {
    setSort(setFirstElementInList(e.currentTarget.value, sort))
    first()
  }, [setFirstElementInList, sort, setSort, first])

  const onChangeFilter = useCallback((value: string, e: React.FormEvent<HTMLInputElement>)=> {
    if (e.currentTarget.checked)
      setFilter([...filter, value] as any)
    else
      setFilter(filter.filter(v=> v !== value))
    // first()
  }, [filter, setFilter, /*first*/])

  useEffect(()=> {
    if (!hasQuery) return
    search("anims", query, {
      limit: 1000,
      filter: `bank = ${bank}`,
      showMatchesPosition: true,
    }).then(
      response=> {
        if (response.query !== query) return
        const result = {}
        response.hits.forEach(({id})=> result[id] = true)
        setQueryResult(result)
        first()
      }
    )
  }, [bank, query, hasQuery, first])

  return (
    <div>
      <H3>{resolved ? bankName : bankName_Hash} <AssetType type="bank"/></H3>
      {
        isLoading ? <p>正在加载...</p> : <>
          <p>总共包含{animationList.length}个动画。
          {
            numFiltered > 0 &&
            <span style={{color: "#999"}}>（{numFiltered}个被隐藏）</span>
          }
          </p>
        </>
      }
      <div style={{display: "flex", alignItems: "center"}}>
        <InputGroup 
          placeholder="筛选"
          spellCheck="false"
          autoComplete="off" 
          leftIcon="filter"
          small
          style={{maxWidth: 200}}
          value={query}
          onChange={e=> onChangeQuery(e.currentTarget.value)}
        />
        <Checkbox style={{margin: 5}} className="no-select"
          checked={filter.indexOf("-pre/pst") !== -1}
          onChange={e=> onChangeFilter("-pre/pst", e)}
        >
          隐藏前/后摇动画（{filterCounts["-pre/pst"]}）
        </Checkbox>
        <Checkbox style={{margin: 5}} className="no-select"
          checked={filter.indexOf("-lag") !== -1}
          onChange={e=> onChangeFilter("-lag", e)}>
          隐藏延迟动画（{filterCounts["-lag"]}）
        </Checkbox>
      </div>
      <br/>
      <table className={style["compact-table"] + " bp4-html-table " + (isLoading ? "bp4-skeleton" : "")}>
        <thead>
          <th>
            <Popover2 minimal placement="right" content={<div className="sort-popover">
              <RadioGroup 
                // selectedValue={getFirstElementInList(["name.a-z", "name.z-a"], sort)}
                selectedValue={sort[0]}
                onChange={onChangeSort}>
                <Radio label="按名字排序（a–z）" value="name.a-z"/>
                <Radio label="按名字排序（z–a）" value="name.z-a"/>
              </RadioGroup>
            </div>}>
              <div style={{cursor: "pointer"}}>
                名字 <Button icon="sort" minimal small/>
              </div>
            </Popover2>
          </th>
          <th>
            <Popover2 minimal placement="right" content={<div className="sort-popover">
              <RadioGroup
                // selectedValue={getFirstElementInList(facingList.map(n=> `facing-${n}`), sort)}
                selectedValue={sort[0]}
                onChange={onChangeSort}>
                {
                  facingList.map(f=> 
                    <Radio label={`将${byte2facing(f)}置顶`} value={`facing-${f}`}/>)
                }
              </RadioGroup>
            </div>}>
              <div style={{cursor: "pointer"}}>
                朝向 <Button icon="sort" minimal small/>
              </div>
            </Popover2>
          </th>
          <th>
            <Popover2 minimal placement="right" content={<div className="sort-popover">
              <RadioGroup
                // selectedValue={getFirstElementInList(["0-9", "9-0"], sort)}
                selectedValue={sort[0]}
                onChange={onChangeSort}>
                <Radio label="按帧数排序（小到大）" value="0-9"/>
                <Radio label="按帧数排序（大到小）" value="9-0"/>
              </RadioGroup>
            </div>
            }>
              <div style={{cursor: "pointer"}}>
                帧数 <Button icon="sort" minimal small/>
              </div>
            </Popover2>
          </th>
          <th>预览</th>
          <th>
            <Popover2 minimal placement="right" content={<div className="sort-popover">
              <RadioGroup
                // selectedValue={getFirstElementInList(["path.a-z", "path.z-a"], sort)}
                selectedValue={sort[0]}
                onChange={onChangeSort}>
                <Radio label="按路径排序（a-z）" value="path.a-z"/>
                <Radio label="按路径排序（z-a）" value="path.z-a"/>
              </RadioGroup>
            </div>
            }>
              <div style={{cursor: "pointer"}}>
                动画包路径 <Button icon="sort" minimal small/>
              </div>
            </Popover2>            
          </th>
        </thead>
        <tbody>
          {
            sortedAnimationList.map((v, i)=> {
              const reposition = {} as any
              if (i < range[0] || i > range[1]) return
              return <tr key={v.id}>
                <td>
                  <PopoverMenu placement="top" menu={[
                    {text: "拷贝名字", icon: "duplicate", copyText: v.name},
                  ]}>
                    {v.name}
                  </PopoverMenu>
                </td>
                <td>{byte2facing(v.facing)}</td>
                <td>{v.numframes}</td>
                <td>
                  <Popover2 interactionKind="hover"
                      placement="right"
                      ref={v=> {reposition.fn = ()=> { v?.reposition() }}}
                      content={<div style={{padding: 5}}>
                    <AnimQuickLook 
                      bankhash={bank}
                      animation={v.name}
                      facing={v.facing}
                      build={v.assetpath.substring(5, v.assetpath.length-4)} // strip anim/xxx.zip -> xxx
                      onResize={()=> reposition.fn?.()}
                    />
                    </div>}>
                    <Button icon="eye-open"/>
                  </Popover2>
                </td>
                <td>
                  <PopoverMenu placement="top" menu={[
                    {text: "拷贝路径", icon: "duplicate", copyText: v.assetpath},
                    {text: "查看动画包详情", icon: "link", directURL: "/asset?id=z-"+smallhash(v.assetpath)}
                  ]}>
                    {v.assetpath}
                  </PopoverMenu>
                </td>
              </tr>
            })
          }
        </tbody>
      </table>
      <PageTurner {...handler} style={{marginTop: 10, marginBottom: 100}}/>
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
  }, [type, forceUpdate])

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