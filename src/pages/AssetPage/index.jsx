import React, { useEffect, useReducer, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { H3, H4, H5, H6, Icon, NonIdealState, Button, Card, Spinner, Checkbox } from '@blueprintjs/core'
import { Collapse, ButtonGroup } from '@blueprintjs/core'
import { ASSET_TYPE } from '../../strings'
import { useLuaCall, useCopyTexElement, useCopyBuildAtlas, useCopySymbolElement, useCopySuccess, useSaveFileCall, useCopyTexture, useLuaCallOnce, useGenericSaveFileCb, useSaveFileDialog } from '../../hooks'
import { appWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/api/clipboard'
import style from './index.module.css'
import Preview from '../../components/Preview'
import ClickableTag from '../../components/ClickableTag'
import Hash from '../../components/HumanHash'
import FacingIcon from '../../components/FacingIcon'
import CCMiniPlayground from '../../components/CCMiniPlayground'
import CCMapViewer from '../../components/CCMapViewer'
import KeepAlivePage from '../../components/KeepAlive/KeepAlivePage'

function KeepAlive(props) {
  return <KeepAlivePage {...props} cacheNamespace="assetPage"/>
}

export default function AssetPage() {
  const [param] = useSearchParams()
  const id = param.get("id")
  const [_, forceUpdate] = useReducer(v=> v + 1, 0)

  if (id === null) return <AssetInvalidPage type="null"/>
  const asset = window.assets_map[id]
  if (!asset) {
    if (Object.keys(window.assets).length === 0){
      return <AssetInvalidPage type="waiting" forceUpdate={forceUpdate}/>
    }
    else {
      console.warning("Invalid asset id: ", id)
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
        // cc page contains webGL context, don't cache it
        return <TexNoRefPage {...asset} key={id} is_cc={true}/>
      else
        return <KeepAlive key={id}>
          <TexNoRefPage {...asset} key={id}/>
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

function TexPage({id, xml, tex}) {
  const navigate = useNavigate()
  const xmlDef = window.assets.allxmlfile.find(a=> a.file === xml)
  const atlasPath = xmlDef ? xmlDef.texpath : "获取失败"
  const ref = useRef()
  const [resolution, setResolution] = useState([0, 0])
  const [loading, setLoading] = useState(true)
  
  const onImgLoad = ({target})=> {
    setResolution([target.width, target.height])
    setLoading(false)
  }

  const call = useLuaCall("load", result=> {
    const array = Uint8Array.from(result)
    const blob = new Blob([array])
    if (ref.current) ref.current.src = URL.createObjectURL(blob)
  }, {type: "image", xml, tex, format: "png", debug:1}, 
    [id, xml, tex])

  useEffect(()=> {
    // setLoading(true)
    call()
  }, [call])

  const download = useSaveFileCall(
    {type: "image", xml, tex}, 
    "image",
    tex + ".png",
  [id, xml, tex])

  const copy = useCopyTexElement(xml, tex)

  return <div>
    <H3>{tex} <AssetType type="tex"/></H3>
    <div className="bp4-running-text">
      <Loading loading={loading}/>
      <img style={{maxWidth: "100%", maxHeight: "80vh", display: loading ? "none" : null}} 
        className='bp4-elevation-1' ref={ref} onLoad={onImgLoad}/>
      <div style={{height: 20}}></div>
      <Button icon="duplicate" onClick={()=> copy()} disabled={loading}>
        拷贝
      </Button>
      &nbsp;
      <Button icon="download" intent='primary' onClick={()=> download()} disabled={loading}>
        下载
      </Button>
      <H5>基本信息</H5>
      <Card elevation={1}>
      <p>分辨率: {resolution[0]}x{resolution[1]}</p>
      <p>所属图集: {xml} &nbsp;
        <Button icon="link" minimal={true}/>
        <Button icon="document-open" minimal={true}/>
      </p>
      <p>资源路径: {atlasPath} &nbsp;
        <Button icon="document-open" minimal={true}/>
      </p>
      </Card>
    </div>
  </div>
}

function TexNoRefPage({id, file, is_cc}) {
  const [resolution, setResolution] = useState([0, 0])
  const [loading, setLoading] = useState(true)
  const [url, setURL] = useState("")
  
  const onImgLoad = ({target})=> {
    setResolution([target.width, target.height])
    setLoading(false)
  }

  useLuaCallOnce("load", result=> {
    const array = Uint8Array.from(result)
    const blob = new Blob([array])
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
      <Loading loading={loading}/>
      <img style={{maxWidth: "100%", maxHeight: "80vh", display: loading ? "none" : null}} 
        className='bp4-elevation-1' src={url} onLoad={onImgLoad}/>
      <div style={{height: 20}}></div>
      <Button icon="duplicate" onClick={()=> copy()} disabled={loading}>
        拷贝
      </Button>
      &nbsp;
      <Button icon="download" intent='primary' onClick={()=> download()} disabled={loading}>
        下载
      </Button>
      <H5>基本信息</H5>
      <p>分辨率: {resolution[0]}x{resolution[1]}</p>
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

function XmlPage({id, file, texpath, _numtex}) {
  const [display, setDisplay] = useState("grid") // TODO: 应该是config
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({})

  const call = useLuaCall("load", result=> {
    result = JSON.parse(result)
    setData(result)
    setLoading(false)
    requestAnimationFrame(()=> appWindow.emit("restore_scroll", {key: id}))
  }, {type: "xml", file},
    [file])
  
  useEffect(()=> {
    setData({})
    // setLoading(true)
    call()
  }, [call])

  return <div>
    <H3>{file} <AssetType type="xml"/></H3>
    <div className="bp4-running-text">
      <H5>图片列表 </H5>
      <p>本图集包含了{_numtex}张图片</p>
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
        data.elements && data.xml === file && (
          display === "grid" ? <XmlPageDisplay.Grid data={data} xml={file}/> : 
          display === "list" ? <XmlPageDisplay.List data={data} xml={file}/> :
          display === "widget" ? <XmlPageDisplay.Atlas data={data} xml={file}/> :
          <></>
        )
      }
      <H5>基本信息</H5>
      <Card elevation={1}>
        <p>xml文件路径: {file}</p>
        <p>tex文件路径: {texpath}</p>
      </Card>
    </div>
  </div>
}

const XmlPageDisplay = {
  Grid({data, xml}) {
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
            <Preview.Image xml={xml} tex={element.name}/>
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

  List({data, xml}) {
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
          <td>{element.width}x{element.height}</td>
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

  Atlas({data, xml}) {
    return <>TODO: 还没做</>
  },
}

function ZipPage({type, file, id}) {
  const [build, setBuildData] = useState(undefined)
  const [foldSymbol, setFoldSymbol] = useState({})
  const [animList, setAnimList] = useState(undefined)
  const [atlas, setAtlas] = useState({})

  const buildCall = useLuaCall("load", result=> {
    if (result == "nil") {
      // `build.bin` not exists
      setBuildData(false)
    }
    else {
      setBuildData(JSON.parse(result))
    }
  }, {type: "build", file}, [file])

  const animCall = useLuaCall("load", result=> {
    if (result == "nil") {
      // `anim.bin` not exists
      setAnimList(false)
    }
    else {
      setAnimList(JSON.parse(result))
    }
  }, {type: "animbin", file}, [file])

  useEffect(()=> {
    buildCall()
    setAtlas({})
  }, [buildCall])

  useEffect(()=> {
    animCall()
  }, [animCall])

  const copyAtlas = useCopyBuildAtlas(file)
  const copyElement = useCopySymbolElement(file)
  const downloadAtlas = useSaveFileCall({
    type: "atlas", build: file  
  }, "image", "TODO: name.png", [file])
  const downloadElement = useSaveFileCall({
    type: "symbol_element", build: file,
  }, "image", "TODO: name.png", [file])

  const onSuccess = useCopySuccess()

  return <div>
    <H3>{file} <AssetType type={type}/></H3>
    <div className="bp4-running-text">
      <H5>材质 <ClickableTag term="build"/></H5>
      {
        build === false ? "本资源包内不包含材质。" :
        build !== undefined ? <>
          <p><strong>名字</strong></p>
          <p className='bp4-monospace-text'>
            {build.name}&nbsp;<Button icon="duplicate" onClick={()=> 
              writeText(build.name).then(()=> onSuccess())}/>
          </p>
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
                        <Button icon="download" intent='primary' onClick={()=> downloadAtlas({sampler: i})}></Button>
                      </td>
                    </tr>)
                }
              </tbody>
            </table>
          </div>
          <p><strong>符号</strong></p>
          <p>
            <Button icon="download" intent="primary" onClick={()=> alert("TODO:这个还没写")}>批量下载</Button>
          </p>
          <div style={{display: "inline-block", border: "1px solid #ddd", borderRadius: 2, marginBottom: 20}}>
            <table className={style["list-container"]}>
              <thead>
                <th></th>
                <th>哈希值</th>
                <th>Symbol</th>
                <th>图片数量</th>
              </thead>
              <tbody>
                {
                  build.symbol.map(({imghash, imglist})=> <>
                    <tr key={imghash} style={{fontWeight: foldSymbol[imghash] ? 700 : null}}>
                      <td style={{cursor: "pointer"}} onClick={()=> setFoldSymbol(sym=> ({...sym, [imghash]: !sym[imghash]}))}>
                        <Icon
                          style={{cursor: "inherit"}}
                          icon={foldSymbol[imghash] ? "chevron-right" : "chevron-down"}
                          className='no-select'
                        /> 
                      </td>
                      <td>{imghash}</td>
                      <td className='bp4-monospace-text'>
                        <Hash hash={imghash}/>
                      </td>
                      <td>{imglist.length}</td>
                    </tr>
                    {
                      !foldSymbol[imghash] && 
                      imglist.map(img=> 
                        <tr key={imghash + "-" + img.index}>
                          <td></td>
                          <td className='bp4-monospace-text'>
                            <Hash hash={imghash}/>-{img.index}
                          </td>
                          <td>
                            <Preview.SymbolElement atlas={atlas} data={img} width={50} height={50}/>
                          </td>
                          <td>
                            <Button icon="duplicate" onClick={()=> copyElement({imghash, index: img.index})}/>
                            <span style={{display: "inline-block", width: 10}}/>
                            <Button icon="download" intent='primary' onClick={()=> downloadElement({imghash, index: img.index})}/>
                          </td>
                        </tr>)
                    }
                  </>)
                }
              </tbody>
            </table>
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
              <th>帧数&nbsp;<Icon icon="help"/> </th>
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
                  <FacingIcon facing={facing}/>
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

function AssetInvalidPage({type, typeName, id, forceUpdate}) {
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
        description={<>
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
        </>}
        style={{maxWidth: 500, width: 500}}
      />
    </div>
  }
}