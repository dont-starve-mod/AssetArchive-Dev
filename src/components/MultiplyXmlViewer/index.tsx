import { Button, Checkbox, Spinner, Tag } from '@blueprintjs/core'
import InputGroup from '../InputGroup'
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import SortableField from '../SortableField'
import { search } from '../../global_meilisearch'
import { useAppStates, useCopyTexElement, useLocalStorage, useLuaCall, useLuaCallOnce, usePagingHandler, useSaveFileCall } from '../../hooks'
import Preview from '../Preview'
import PageTurner from '../PageTurner'
import PopoverMenu from '../PopoverMenu'
import { open } from '@tauri-apps/plugin-dialog'
import { Tex } from '../../searchengine'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { usePushItemsToMaxView } from '../AppMaxView'
const appWindow = getCurrentWebviewWindow()

type MultiplyXmlViewerProps = {
  xml?: string,
  xmlList?: string[] | (()=> string[]),
  deprecatedXmlList?: string[] | ((v: string)=> boolean),
  hideXmlSource?: true,
  exportFolderName?: string,
}

export function BatchExportingButton(props: 
  {text: string, items: (Pick<Tex, "xml" | "tex">)[], 
  disabled?: boolean, buttonStyle?: React.CSSProperties}) {
  // @ts-ignore TODO: fix export folder
  const {exportFolderName = "export", items, text, buttonStyle, disabled} = props
  const [loading, setLoading] = useState(false)
  const exportImages = useLuaCall<string>("batch_download", response=> {
    const data = JSON.parse(response)
    setLoading(false)
    if (data.success)
      appWindow.emit("toast", {
        message: "导出成功",
        icon: "saved", 
        intent: "success",
        savepath: data.output_dir_path 
      })
  }, {type: "tex"}, [])

  const onClickExport = useCallback(async(items: ({xml: string, tex: string})[])=> {
    const dirpath = await open({
      directory: true,
      multiple: false,
      title: ""
    })
    if (typeof dirpath === "string"){
      setLoading(true)
      exportImages({
        target_dir: dirpath,
        tex_list: items.map(({xml, tex})=> ({xml, tex})),
        folder_name: exportFolderName,
      })
    }
  }, [exportImages, exportFolderName])

  return (
    <Button loading={loading} disabled={disabled} style={buttonStyle} onClick={()=> onClickExport(items)}>
      {text} <Tag minimal>{items.length}</Tag>
    </Button>
  )
}

export default function MultiplyXmlViewer(props: MultiplyXmlViewerProps) {
  const {xml, xmlList, hideXmlSource = false, exportFolderName = "export"} = props
  const [_, forceUpdate] = useReducer(v => v + 1, 0)
  const [resData, setResData] = useState<{[id: string]: {width: number, height: number}}>({})
  const assetLoaded = Array.isArray(window.assets.alltexelement) && window.assets.alltexelement.length > 0

  useEffect(()=> {
    let timer = setInterval(()=> {
      if (!assetLoaded) forceUpdate()
    }, 500)
    return ()=> clearInterval(timer)
  }, [assetLoaded, forceUpdate])

  const listStr = assetLoaded ? (JSON.stringify(
    Array.isArray(xmlList) ? xmlList : 
    typeof xmlList === "function" ? xmlList() :
    typeof xml === "string" ? [xml] :
    [])) : "[]"

  const allTex = useMemo(()=> {
    return assetLoaded && window.assets.alltexelement.filter(
      v=> listStr.indexOf(v.xml) !== -1
    ).toSorted()
  }, [listStr, assetLoaded])

  const deprecatedXmlList = useMemo(()=> {
    if (typeof props.deprecatedXmlList === "function") 
      return JSON.parse(listStr).filter(props.deprecatedXmlList)
    else if (Array.isArray(props.deprecatedXmlList))
      return props.deprecatedXmlList
    else 
      return []
  }, [props.deprecatedXmlList, listStr])

  const deprecatedXmlListStr = deprecatedXmlList.length === 1 ?
    deprecatedXmlList[0] : 
    `${deprecatedXmlList[0]}等${deprecatedXmlList.length}个图集`

  useLuaCallOnce<string>("load", response=> {
    const xmlData = JSON.parse(response)
    const resData = {}
    // @ts-ignore
    Object.values(xmlData).forEach(({elements})=> {
      elements.forEach(({id, width, height})=> {
        resData[id] = {
          width, height
        }
      })
    })
    setResData(resData)
  }, {type: "xml", file_list: listStr}, [listStr], [typeof listStr === "string"])

  const [query, setQuery] = useState("")
  const hasQuery = query.trim() !== ""
  const [queryResult, setQueryResult] = useState<{[id: string]: true}>({})

  useEffect(()=> {
    if (!hasQuery) return
    search("assets", query, {
      limit: 200,
      filter: "type = tex AND xml IN " + listStr,
    }).then(response=> {
      if (response.query === query){
        let result = {}
        response.hits.forEach(v=> result[v.id] = true)
        setQueryResult(result)
      }
    })
  }, [query, hasQuery, listStr])

  const [sort, setSort] = useLocalStorage("multiple_xml_sort_strategy")
  const [filter, setFilter] = useLocalStorage("multiple_xml_filter_strategy")
  const filterDeprecated = filter.indexOf("-deprecated") !== -1
  const [filterDesc, setFilterDesc] = useLocalStorage("debug_filter_desc")

  const items = useMemo(()=> {
    if (!assetLoaded) return []
    let items = allTex
    items = hasQuery ? allTex.filter(v=> queryResult[v.id]) : allTex
    items = filterDeprecated ? items.filter(v=> deprecatedXmlList.indexOf(v.xml) === -1) : items
    items = filterDesc ? items.filter(v=> !v.plain_desc) : items
    const getWidth = (id: string)=> resData[id] ? resData[id].width : 0
    const getHeight = (id: string)=> resData[id] ? resData[id].height : 0
    const sortedItems = items.sort((a, b)=> {
      for (let s of sort){
        switch(s){
          case "name.a-z":
          case "name.z-a":
            return (s === "name.a-z" ? 1 : -1) * a.tex.localeCompare(b.tex)
          case "res.width.0-9":
          case "res.width.9-0":
            return (s === "res.width.0-9") === (getWidth(a.id) < getWidth(b.id)) ? -1 : 1
          case "res.height.0-9":
          case "res.height.9-0":
            return (s === "res.height.0-9") === (getHeight(a.id) < getHeight(b.id)) ? -1 : 1
          default:
            if (s.startsWith("xml-")){
              const ax = ("xml-" + a.xml) === s
              const bx = ("xml-" + b.xml) === s
              if (ax !== bx) return ax ? -1 : 1
            }
        }
      }
      return 0
    })
    return sortedItems
  }, [assetLoaded, hasQuery, filterDeprecated, filterDesc, allTex, queryResult, sort, deprecatedXmlList, resData])

  const uid = usePushItemsToMaxView("tex", items)
  const openMaxView = useAppStates("max_view_open")[1]

  const handler = usePagingHandler(items, {
    resetScroll: ()=> document.getElementById("app-article")?.scrollTo(0, 1)
  })
  const {range, first} = handler

  const onChangeSort = useCallback((e: React.FormEvent<HTMLInputElement>)=> {
    const value = e.currentTarget.value
    setSort([value, ...sort.filter(v=> v !== value && !v.startsWith("xml-"))])
    first()
  }, [sort, setSort, first])

  const copy = useCopyTexElement(null, null)
  const download = useSaveFileCall(
    {type: "image"},
    "image",
    "image.png", [])


  if (!assetLoaded) {
    return (
      <div>
        <p>正在加载...</p>
        <Spinner style={{justifyContent: "left"}}/>
      </div>
    )
  }

  return (
    <div>
      <div style={{display: "flex", alignContent: "center", marginBottom: 5}}>
        <InputGroup
          placeholder= "筛选"
          leftIcon="filter"
          small
          style={{maxWidth: 200}}
          onChange2={setQuery}
          search
        />
        {
          deprecatedXmlList.length > 0 && 
          <Checkbox 
            checked={filterDeprecated}
            onChange={e=> setFilter(e.currentTarget.checked ? ["-deprecated"] : [])}
            style={{marginLeft: 10}}>
            隐藏弃用的图集（{deprecatedXmlListStr}）
          </Checkbox>
        }
        {
          window.show_debug_tools &&
          <Checkbox
            checked={filterDesc}
            onChange={e=> setFilterDesc(e.currentTarget.checked)}
            className="ml-2"
          >
            隐藏所有注释（Debug）
          </Checkbox>
          }
      </div>
      <div style={{marginBottom: 5}}>
        <BatchExportingButton text="导出全部" items={allTex} buttonStyle={{marginRight: 4}}/>
        <BatchExportingButton text="导出筛选结果" disabled={items.length === 0} items={items}/>
      </div>
      <table className={`bp4-html-table compact-table`}>
        <thead>
          <tr>
            <th>
              <SortableField text="图片名" selectedValue={sort[0]} onChange={onChangeSort} choices={[
                {label: "按图片名排序（a–z）", value: "name.a-z"},
                {label: "按图片名排序（z–a）", value: "name.z-a"},
              ]}
              />
            </th>
            <th style={{minWidth: 120}}>
              <SortableField text="分辨率" selectedValue={sort[0]} onChange={onChangeSort} choices={[
                {label: "按宽度排序（从大到小）", value: "res.width.9-0"},
                {label: "按宽度排序（从小到大）", value: "res.width.0-9"},
                {label: "按高度排序（从大到小）", value: "res.height.9-0"},
                {label: "按高度排序（从小到大）", value: "res.height.0-9"},
              ]}
              />
            </th>
            <th>
              <SortableField.NoSort text="预览"/>
            </th>
            <th>
              <SortableField.NoSort text="操作"/>
            </th>
            {
              !hideXmlSource && 
              <th>
                <SortableField text="所属图集" selectedValue={sort[0]} onChange={onChangeSort} choices={
                  typeof listStr === "string" ?
                    JSON.parse(listStr).map(
                      (v: string)=> ({label: `将${v}置顶`, value: "xml-" + v})) : []
                }
                />
              </th>
            }
          </tr>
        </thead>
        <tbody>
          {
            items.map(({id, xml, tex, plain_desc}, i)=> {
              return i >= range[0] && i <= range[1] && 
              <tr key={id}>
                <td>
                  <PopoverMenu menu={[
                    {icon: "duplicate", text: "拷贝路径", copyText: tex},
                    {icon: "link", text: "查看详情", directURL: `/asset?id=${id}`},
                  ]}>
                    {tex}
                  </PopoverMenu>
                  <p style={{color: "#aaa"}}>{plain_desc}</p>
                </td>
                <td>{resData[id] ? `${resData[id].width}✕${resData[id].height}` : "-"}</td>
                <td>
                  <div className="cursor-zoom-in" onClick={()=> openMaxView({uid, index: i})}>
                    <Preview.Image xml={xml} tex={tex} width={40} height={40}/>
                  </div>
                </td>
                <td style={{minWidth: 100}}>
                  <Button icon="duplicate" style={{marginRight: 4}}  onClick={()=> {
                    copy({xml, tex})
                  }}/>
                  <Button icon="download" onClick={()=> {
                    download({xml, tex, defaultPath: tex})
                  }}/>
                </td>
                {
                  !hideXmlSource && 
                  <td>
                    <PopoverMenu menu={[
                      {icon: "duplicate", text: "拷贝路径", copyText: xml},
                    ]}>
                      {xml}
                    </PopoverMenu>
                  </td>
                }
              </tr>
            })
          }
        </tbody>
      </table>
      <PageTurner {...handler}/>
    </div>
  )
}

function getIndex(xml: string) {
  return parseInt(xml.match(/\d+/)?.[0] || "99999")
}

MultiplyXmlViewer.InventoryImages = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={()=> window.assets.allxmlfile
        .map(v=> v.file)
        .filter(v=> v.indexOf("images/inventoryimages") !== -1)
        .toSorted((a, b)=> getIndex(a) - getIndex(b))}
      deprecatedXmlList={["images/inventoryimages.xml"]}
    />
  )
}

MultiplyXmlViewer.Wallpapers = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={()=> window.assets.allxmlfile.map(v=> v.file).filter(
        v=> v.indexOf("images/bg_loading_loading") !== -1)}
    />
  )
}

MultiplyXmlViewer.CharacterPortraits = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={()=> window.assets.allxmlfile.map(v=> v.file).filter(
        v=> v.indexOf("bigportraits/") !== -1)}
      deprecatedXmlList={v=> v.indexOf("_") === -1}
    />
  )
}

MultiplyXmlViewer.Minimaps = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={()=> window.assets.allxmlfile.map(v=> v.file).filter(
        v=> v.indexOf("minimap/minimap_data") !== -1)}
      deprecatedXmlList={v=> v === "minimap/minimap_data.xml"}
    />
  )
}

MultiplyXmlViewer.UI = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={[
        "images/ui.xml",
        "images/global_redux.xml",
        "images/hud.xml",
        "images/hud2.xml",
        "images/button_icons.xml",
        "images/button_icons2.xml",
      ]}
    />
  )
}

MultiplyXmlViewer.Skilltrees = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={()=> window.assets.allxmlfile.map(v=> v.file).filter(
        v=> v.indexOf("images/skilltree") !== -1)}
    />
  )
}

MultiplyXmlViewer.Scrapbooks = ()=> {
  return (
    <MultiplyXmlViewer
      xmlList={()=> window.assets.allxmlfile.map(v=> v.file).filter(
        v=> v.indexOf("images/scrapbook") !== -1)}
    />
  )
}