import React, { useEffect, useRef, useState } from 'react'
import { useLoaderData, useNavigate, useSearchParams } from 'react-router-dom'
import { H3, H4, H5, H6, Icon, NonIdealState, Button, Card, Spinner, Checkbox } from '@blueprintjs/core'
import { Collapse, ButtonGroup } from '@blueprintjs/core'
import { ASSET_TYPE } from '../../strings'
import { useLuaCall, useCopyTexElement, useCopyBuildAtlas, useCopySymbolElement, useCopySuccess } from '../../hooks'
import { appWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/api/clipboard'
import { save } from '@tauri-apps/api/dialog'
import style from './index.module.css'
import Preview from '../../components/Preview'
import ClickableTag from '../../components/ClickableTag'
import Hash from '../../components/HumanHash'
import FacingIcon from '../../components/FacingIcon'

export default function AssetPage() {
  const [param] = useSearchParams()
  const id = param.get("id")

  if (id === null) return <AssetInvalidPage type="null"/>
  const asset = window.assets_map[id]
  if (!asset) {
    if (Object.keys(window.assets).length === 0){
      return <AssetInvalidPage type="waiting"/>
    }
    else {
      return <AssetInvalidPage type="invalid-id" id={id}/>
    }
  }

  const {type} = asset
  switch(type) {
    case "tex": return <TexPage {...asset}/>
    case "xml": return <XmlPage {...asset}/>
    case "animzip": return <ZipPage {...asset}/>
    case "animdyn": return <ZipPage {...asset}/>
  }

  return (
    <div>
      <h2>AssetPage</h2>
    </div>
  )
}

// function AssetType({type}) {
//   return <div style={{display: "inline-block", verticalAlign: "middle"}}>
//     <div style={{display: "flex", justifyContent: "center"}}>
//       <Tag interactive={true} onClick={()=> window.alert("TODO:实现")}>
//         {ASSET_TYPE[type]}
//       </Tag>
//     </div>
//   </div>
// }

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
  const xmlDef = window.assets.allxmlfile.find(a=> a.file === xml)
  const atlasPath = xmlDef ? xmlDef.texpath : "获取失败"
  const ref = useRef()
  const [resolution, setResolution] = useState([0, 0])
  const [loading, setLoading] = useState(true)

  useEffect(()=> {
    appWindow.emit("reset_scroll")
  }, [])
  
  const onImgLoad = ({target})=> {
    setResolution([target.width, target.height])
    setLoading(false)
  }

  const call = useLuaCall("load", result=> {
    const array = Uint8Array.from(result)
    const blob = new Blob([array])
    ref.current.src = URL.createObjectURL(blob)
  }, {type: "image", xml, tex, format: "png"}, 
    [id, xml, tex])

  useEffect(()=> {
    setLoading(true)
    call()
  }, [call])

  const download = async ()=> {
    const path = await save({
      // defaultPath: "",
      filters: [
        {name: "Image", extensions: ["png"]}
      ]
    })
    console.log(path)
  }

  const copy = useCopyTexElement(xml, tex)

  return <div>
    <H3>{tex} <AssetType type="tex"/></H3>
    <div className="bp4-running-text">
      <Loading loading={loading}/>
      <img style={{maxWidth: "100%", maxHeight: "80vh", display: loading ? "none" : null}} 
        className='bp4-elevation-1' ref={ref} onLoad={onImgLoad}/>
      <div style={{height: 20}}></div>
      <Button icon="download" intent='primary' onClick={download} disabled={loading}>
        下载
      </Button>
      &nbsp;
      <Button icon="duplicate" onClick={()=> copy()} disabled={loading}>
        拷贝
      </Button>
      <H5>基本信息</H5>
      <Card elevation={1}>
      <p>分辨率: {resolution[0]}x{resolution[1]}</p>
      <p>所属图集: {xml}</p>
      <p>资源路径: {atlasPath}</p>
      </Card>
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
  }, {type: "xml", file},
    [file])
  
  useEffect(()=> {
    setData({})
    setLoading(true)
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
                  <Button icon="download" intent='primary'>下载TODO:</Button>             
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
    return <table className={style["list-container"]} border={0}>
      <thead>
        <th><Checkbox inline={true} style={{marginRight: 0}} /></th>
        <th>名字</th>
        <th>分辨率</th>
        <th>图片</th>
        <th>&nbsp;操作</th>
      </thead>
      <tbody>
      {
        data.elements.map((element, _)=> 
        <tr key={element.id}>
          <td>
            <Checkbox/>
          </td>
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
            <Button icon="download"/>
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
  const [unfoldSymbol, setUnfoldSymbol] = useState({})
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
                        <Button icon="download" intent='primary'></Button>
                      </td>
                    </tr>)
                }
              </tbody>
            </table>
          </div>
          <p><strong>符号</strong></p>
          <p>
            <Button icon="download" intent="primary">批量下载</Button>
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
                    <tr key={imghash} style={{fontWeight: unfoldSymbol[imghash] ? 700 : null}}>
                      <td style={{cursor: "pointer"}} onClick={()=> setUnfoldSymbol(sym=> ({...sym, [imghash]: !sym[imghash]}))}>
                        <Icon
                          style={{cursor: "inherit"}}
                          icon={unfoldSymbol[imghash] ? "chevron-down" : "chevron-right"}
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
                      unfoldSymbol[imghash] && 
                      imglist.map(img=> 
                        <tr key={imghash + "-" + img.index}>
                          <td></td>
                          <td className='bp4-monospace-text'>
                            <Hash hash={imghash}/>-{img.index}
                          </td>
                          <td>
                            <Preview.SymbolElement atlas={atlas} data={img}/>
                          </td>
                          <td>
                            <Button icon="duplicate" onClick={()=> copyElement({imghash, index: img.index})}/>
                            <span style={{display: "inline-block", width: 10}}/>
                            <Button icon="download" intent='primary'/>
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

function AssetInvalidPage({type, id}) {
  const navigate = useNavigate()
  const url = location.href.substring(location.origin.length)
  
  useEffect(()=> {
    const token = setInterval(()=> {
      if (type === "waiting"){
        console.log("RELOAD: " + url)
        navigate(url)
      }
    }, 500)
    return ()=> clearInterval(token)
  }, [])

  if (type === "waiting"){
    return <NonIdealState title="正在加载" layout='vertical'>
      <Spinner/>
      <Button onClick={()=> navigate(url)}>刷新</Button>
    </NonIdealState>
  }
  return <div style={{marginTop: 30}}>
    <NonIdealState title="加载失败" icon="search" layout="vertical"
      description={<>
        <p>{"原因：资源地址无效" + 
          (type === "null" ? "（id = null）" : `（${id}）`)}
        </p>
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