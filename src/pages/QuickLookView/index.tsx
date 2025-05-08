import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLuaCallOnce } from "../../hooks"
import { Button, Checkbox, H3 } from "@blueprintjs/core"
import { base64DecToArr, toByteArray } from "../../base64_util"
import { byte2facing } from "../../facing"

const transparentStyle: React.CSSProperties = {
  backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 8px 8px",
}

export default function QuickLookView() {
  const filepath = window.filepath
  const [data, setData] = useState([])

  useLuaCallOnce<string>("quicklook_load", data=> {
    setData(JSON.parse(data))
  }, { filepath }, [])

  return (
    <div className="p-4 w-screen h-screen overflow-auto [&>div]:mb-4">
      {/* <H3>{window.filename}</H3> */}
      {/* {filepath} */}
      {
        data.map(v=> {
          if (v.error) {
            return v.error
          }
          const {type} = v
          switch(type) {
            case "tex": return <LookTex format={v.format} img_json={v.img_json}/>
            case "anim": return <LookAnim list={v.animlist}/>
            case "build": return <LookBuild invalid_utf8={v.invalid_utf8} name={v.name} atlas={v.atlas} symbol={v.symbol}/>
            case "zip": return <LookZip name_list={v.name_list}/>
            case "ref_atlas": return <LookRefAtlas ref_missing={v.ref_missing} index={v.atlas_index} name={v.atlas_name} locked={v.locked} img_json={v.img_json}/>
            case "xml": return <LookXml texname={v.texname} imgs={v.imgs}/>
            case "ref_tex": return <LookRefTex name={v.name} format={v.format} img_json={v.img_json}/>
            case "fev": return <LookFev proj_name={v.proj_name} event_path_list={v.event_path_list}/>
            case "fsb": return <LookFsb format={v.format} sample_list={v.sample_list}/>
            case "ksh": return <LookKsh vs={v.vs} vs_name={v.vs_name} ps={v.ps} ps_name={v.ps_name}/>
            case "raw_txt":
            case "raw_bin": 
            case "raw_image": return <LookRaw type={type.replace("raw_", "")} content={v.content} large_file_threshold={v.large_file_threshold}/>
          }

          return JSON.stringify(v)
        })
      }
      
    </div>
  )
}

type LookAnimProps = {
  list: Array<{
    name: string,
    bankhash: number,
    facing: number,
    framerate: 30 | 40,
    rect: any,
    frame: any[],
  }>
}

function LookAnim(props: LookAnimProps) {
  const {list} = props
  const [resolvedHash, setUnresolvedHash] = useState(null)

  const hashCollection = useMemo(()=> {
    let c = new Set<number>()
    list.forEach(({bankhash})=> {c.add(bankhash)})
    return c
  }, [list])

  useLuaCallOnce<string>("get_hash", result=> {
    const data = JSON.parse(result)
    let map = new Map<number, string>()
    data.forEach(([hash, name])=> map.set(hash, name))
    setUnresolvedHash(map)
  }, { hash_list: [...hashCollection.keys()] }, [hashCollection])

  const hashToString = useCallback((hash: number)=> {
    return resolvedHash?.get(hash) || `HASH-${hash}`
  }, [resolvedHash])

  return (
    <div>
      <p className="font-bold">动画列表:</p>
      <table className="mx-2 my-0 p-1 rounded-[2px] border border-solid border-slate-400">
        <thead>
          <tr className="text-left [&>th]:px-[8px] [&>th]:py-[2px]">
            <th>名字</th>
            <th>Bank</th>
            <th>Bank(hash)</th>
            <th>朝向</th>
            <th>帧率</th>
          </tr>
        </thead>
        <tbody>
          {
            list.map((v, i)=> {
              return (
                <tr key={i} className="[&>td]:px-[8px] [&>td]:py-[2px]">
                  <td className="max-w-[90vw] min-w-[150px] overflow-hidden text-ellipsis">{v.name}</td>
                  <td>{hashToString(v.bankhash)}</td>
                  <td>{v.bankhash}</td>
                  <td>{byte2facing(v.facing)}</td>
                  <td>{v.framerate}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
      {/* <RegisterButton/> */}
    </div>
  )
}

type LookXmlProps = {
  texname: string,
  imgs: {[K: string]: any},
}

function LookXml(props: LookXmlProps) {
  const {texname, imgs} = props
  return (
    <div>
      {texname}
      {Object.keys(imgs)}
    </div>
  )
}

type LookRefTexProps = {
  name: string,
  format: string,
  img_json: string,
}

function LookRefTex(props: LookRefTexProps){
  const {name, format, img_json} = props

  return (
    <div>
      <p className="font-bold">{name}</p>
      <LookTex format={format} img_json={img_json}/>
    </div>
  )
}


type LookBuildProps = {
  invalid_utf8: boolean,
  name: string,
  atlas: string[],
  symbol: Array<{
    imghash: number,
    imglist: Array<{
      index: number,
      duration: number,
      bbx: number,
      bby: number,
      cw: number,
      ch: number,
      x: number,
      y: number,
      w: number,
      h: number,
    }>
  }>,
}

function LookBuild(props: LookBuildProps) {
  const { invalid_utf8, name, atlas, symbol } = props
  const [resolvedHash, setUnresolvedHash] = useState(null)
  const hashCollection = useMemo(()=> {
    let c = new Set<number>()
    symbol.forEach(v=> {c.add(v.imghash)})
    return c
  }
  , [symbol])
  useLuaCallOnce<string>("get_hash", result=> {
    const data = JSON.parse(result)
    let map = new Map<number, string>()
    data.forEach(([hash, name])=> map.set(hash, name))
    setUnresolvedHash(map)
  }, { hash_list: [...hashCollection.keys()] }, [hashCollection])

  const hashToString = useCallback((hash: number)=> {
    return resolvedHash?.get(hash) || `HASH-${hash}`
  }, [resolvedHash])

  return (
    <div>
      <p className="font-bold">{name}</p>
      {/* <p>{atlas}</p> */}
      <table className="mx-2 my-0 p-1 rounded-[2px] border border-solid border-slate-400">
        <thead>
          <tr className="text-left [&>th]:px-[8px] [&>th]:py-[2px]">
            <th>符号</th>
            <th>符号(hash)</th>
            <th>图片数量</th>
          </tr>
        </thead>
        <tbody>
          {
            symbol.map((v, _)=> {
              return (
                <tr key={v.imghash} className="[&>td]:px-[8px] [&>td]:py-[2px]">
                  <td className="max-w-[90vw] min-w-[150px] overflow-hidden text-ellipsis">{hashToString(v.imghash)}</td>
                  <td>{v.imghash}</td>
                  <td>{v.imglist.length}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </div>
  )
}

type LookRefAtlasProps = {
  ref_missing: boolean,
  index: number,
  name: string,
  locked: boolean,
  img_json: string,
}

function LookRefAtlas(props: LookRefAtlasProps) {
  const {ref_missing, index, name, locked, img_json} = props

  if (ref_missing)
    return (
      <div>
        <p className="font-bold">{name}</p>
        <p className="opacity-50">贴图不存在</p>
      </div>
    )
  else if (locked)
    return (
      <div>
        <p className="font-bold">#{index}.tex</p>
        <p className="opacity-50">贴图被锁定</p>
      </div>
    )
  else 
    return <LookRefAtlasImage name={name} img_json={img_json}/>
}

function LookRefAtlasImage(props: Pick<LookRefAtlasProps, "img_json" | "name">) {
  const {name, img_json} = props
  return (
    <div>
      <p className="font-bold">{name}</p>
      <LookTex img_json={img_json}/>
    </div>
  )
}

type LookTexProps = {
  format?: string, // pixel format
  img_json: string, // w, h, rgba
}

function LookTex(props: LookTexProps) {
  const {format, img_json} = props
  const [resolution, setResolution] = useState([0, 0])
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(()=> {
    const data = JSON.parse(img_json)
    const {width, height, rgba} = data
    const pixels = base64DecToArr(rgba)
    const img = new ImageData(pixels, width, height)
    const canvas = ref.current!
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.putImageData(img, 0, 0)
    setResolution([width, height])
  }, [img_json])

  return (
    <div>
      <canvas 
        ref={ref}
        draggable="false"
        className="max-w-full min-w-[100px] border-[1px] border-gray-400 border-solid select-none"
        style={{...transparentStyle}}/>
      <p className="mt-4">分辨率: {resolution[0]}×{resolution[1]}</p>
      {
        format && <p>编码格式: {format}</p>
      }
    </div>
  )
}

type LookZipProps = {
  name_list: string[],
}

function LookZip(props: LookZipProps) {
  const {name_list} = props
  return (
    <div>
      <p className="font-bold">压缩包文件列表: </p>
      <table className="mx-2 my-0 p-1 rounded-[2px] border border-solid border-slate-400">
        <thead>
          <tr className="text-left [&>th]:px-[8px] [&>th]:py-[2px]">
            <th>名字</th>
          </tr>
        </thead>
        {/* <tbody className="max-h-[400px] overflow-y-auto table-fixed"> */}
        <tbody>
          {
            name_list.map((v, i)=> {
              return (
                <tr key={i} className="[&>td]:px-[8px] [&>td]:py-[2px]">
                  <td className="max-w-[90vw] min-w-[150px] overflow-hidden text-ellipsis">{v}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </div>
  )
}

type LookFsbProps = {
  format: string, // wave format
  sample_list: Array<{
    name: string,
    default_name: string,
    frequency: number,
    channels: number,
  }>
}

function LookFsb(props: LookFsbProps) {
  const {format, sample_list} = props

  return (
    <div>
      <p>压缩格式: {format}</p>
      <p>音频文件列表: </p>
      <table className="mx-2 my-0 p-1 rounded-[2px] border border-solid border-slate-400">
        <thead>
          <tr className="text-left [&>th]:px-[8px] [&>th]:py-[2px]">
            <th>名字</th>
            <th>信息</th>
          </tr>
        </thead>
        <tbody>
          {
            sample_list.map((v, i)=> {
              return (
                <tr key={i} className="[&>td]:px-[8px] [&>td]:py-[2px]">
                  <td className="max-w-[90vw] min-w-[150px] overflow-hidden text-ellipsis">{v.name}</td>
                  <td>{v.frequency}Hz - {v.channels > 1 ? "双" : "单"}声道</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </div>
  )
}

type LookFevProps = {
  proj_name: string,
  event_path_list: Array<string>
}

function LookFev(props: LookFevProps) {
  const {proj_name, event_path_list} = props
  return (
    <div>
      {/* <p>根路径: {proj_name}</p> */}
      <p>音效列表: </p>
      <table className="mx-2 my-0 p-1 rounded-[2px] border border-solid border-slate-400">
        <thead>
          <tr className="text-left [&>th]:px-[8px] [&>th]:py-[2px]">
            {/* <th>名字</th> */}
          </tr>
        </thead>
        <tbody>
          {
            event_path_list.map((v, i)=> {
              return (
                <tr key={i} className="[&>td]:px-[8px] [&>td]:py-[2px]">
                  <td className="max-w-[90vw] min-w-[150px] overflow-hidden text-ellipsis">{proj_name}/{v}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </div>
  )
}

type LookKshProps = {
  vs: string,
  vs_name: string,
  ps: string,
  ps_name: string,
}

function LookKsh(props: LookKshProps) {
  const {vs, vs_name, ps, ps_name} = props
  return (
    <div>
      <p className="font-bold">{vs_name}</p>
      <pre className="bg-slate-200 p-2 rounded-[2px]">{vs}</pre>
      <hr/>
      <p className="font-bold">{ps_name}</p>
      <pre className="bg-slate-200 p-2 rounded-[2px]">{ps}</pre>
    </div>
  )
}

type LookRawProps = {
  type: (string & {}) | "txt" | "bin" | "image",
  content: string,
  large_file_threshold?: number,
}

function LookRaw(props: LookRawProps) {
  const {type, content, large_file_threshold} = props
  const [url, setUrl] = useState("")
  const [resolution, setResolution] = useState([0, 0])

  const textContent = useMemo(()=> {
    if (type === "txt") {
      let arr = toByteArray(content)
      return String.fromCharCode(...arr)
    }
  }, [content, type])

  const binaryContent = type === "bin" ? content : ""

  useEffect(()=> {
    if (type === "image") {
      let bytes = base64DecToArr(content)
      const blob = new Blob([bytes], {type: "image/png"})
      const url = URL.createObjectURL(blob)
      setUrl(url)
    }
  }, [content, type])
  
  return (
    <div>
      {
        type === "bin" && <p>未知格式的二进制文件。</p>
      }
      {
        large_file_threshold && <p className="text-red-500">文件过大（&gt;{large_file_threshold} MB），只会显示一部分内容。</p>
      }
      {
        type === "image" ? 
        <img 
          src={url} 
          className="max-w-full min-w-[100px] border-[1px] border-gray-400 border-solid select-none" 
          style={{...transparentStyle}}
          // @ts-ignore
          onLoad={v=> setResolution([v.target.naturalWidth, v.target.naturalHeight])}
        /> :
        <pre className="bg-slate-200/0 p-2 rounded-[2px]">
          {
            textContent
          }
          {
            binaryContent
          }
        </pre>
      }
      {
        type === "image" && <p>分辨率: {resolution[0]}×{resolution[1]}</p>
      }
    </div>
  )
}

function RegisterButton() {
  return (
    <Button className="m-2" icon="insert" intent="primary">
      载入动画渲染器
    </Button>
  )
}