import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { FmodEvent } from '../../searchengine'
import { Button, InputGroup, Spinner, Tag } from '@blueprintjs/core'
import { search } from '../../global_meilisearch'
import SortableField, { useSoundSorter } from '../SortableField'
import { useLocalStorage, usePagingHandler } from '../../hooks'
import { CategoryPrefix, formatSoundCategory, formatSoundLength } from '../../format'
import { ParamSlider, PlayIcon } from '../../pages/AssetPage'
import PopoverMenu from '../PopoverMenu'
import { appWindow } from '@tauri-apps/api/window'
import { killPreviewSfx } from '../Preview'
import PageTurner from '../PageTurner'

type MultiplySoundViewerProps = {
  soundList: ()=> FmodEvent[],
  hideProject?: boolean,
}

export default function MultiplySoundViewer(props: MultiplySoundViewerProps) {
  const {soundList, hideProject} = props
  const [_, forceUpdate] = useReducer(v => v + 1, 0)

  /* eslint-disable react-hooks/exhaustive-deps */
  const sounds = soundList() || []
  const assetLoaded = sounds.length > 0

  useEffect(()=> {
    // listen for page cache
    let unlisten = appWindow.listen<any>("unmount_cache", ({payload: {cacheId}})=> {
      if (cacheId.startsWith("assetPage")) {
        killPreviewSfx()
      }
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  useEffect(()=> {
    let timer = setInterval(()=> {
      if (!assetLoaded) forceUpdate()
    }, 500)
    return ()=> clearInterval(timer)
  }, [assetLoaded, forceUpdate])

  const [query, setQuery] = useState("")
  const hasQuery = query.trim() !== ""
  const [queryResult, setQueryResult] = useState<{[id: string]: true}>({})

  useEffect(()=> {
    if (!hasQuery) return
    search("assets", query, {
      filter: "type = fmodevent",
      limit: 1000,
    }).then(response=> {
      if (response.query === query){
        let result = {}
        response.hits.forEach(v=> result[v.id] = true)
        console.log(response.hits)
        setQueryResult(result)
      }
    })
  }, [query, hasQuery])

  // TODO: 需要一个静态api获取音效是否为空

  const numEmpty = 0

  console.log(sounds)

  const [filter, setFilter] = useLocalStorage("fev_filter_strategy")
  const [sort, setSort] = useLocalStorage("fev_sort_strategy")
  const compareFn = useSoundSorter(sort)
  const noEmpty = filter.indexOf("-empty") !== -1

  const items = useMemo(()=> {
    let items = sounds
    if (hasQuery){
      items = items.filter(v=> queryResult[v.id])
    }
    if (noEmpty){
      // TODO: filter empty
    }
    return items.toSorted(compareFn)
  }, [compareFn, noEmpty, sounds, hasQuery, queryResult])

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
      // if (abstract && abstract[path] && !abstract[path].has_sounddef)
      //   data["hasEmpty"] = true
      if (param_list.length > 0)
        param_list.forEach(({name})=> paramNames.add(name))
      else
        data["hasNoParam"] = true
    })
    data.paramNames = [...paramNames].toSorted()
    return data
  }, [items])

  console.log(items)
  // }, [items, abstract])
  
  const resetScroll = useCallback(()=> {
    document.getElementById("app-article").scrollTop = 1
  }, [])

  const handler = usePagingHandler(items, {resetScroll})
  const {first, range} = handler

  const onChangeSort = useCallback((e: React.FormEvent<HTMLInputElement>)=> {
    const value = e.currentTarget.value
    setSort([value, ...sort.filter(v=> v !== value)])
    first()
  }, [sort, setSort, first])

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
          spellCheck="false"
          autoComplete="off"
          leftIcon="filter"
          small
          style={{maxWidth: 200}}
          value={query}
          onChange={e=> setQuery(e.currentTarget.value)}
        />
      </div>
      <div>
        {/* <Button>全部</Button>
        <Button>筛选</Button> */}
        <Tag minimal>音效总数 {sounds.length}</Tag>
        <Tag minimal className="m-1">当前显示 {items.length}</Tag>
      </div>
      <table className={`bp4-html-table compact-table`}>
        <thead>
          <tr>
            <th>
              <SortableField text="路径" selectedValue={sort[0]} onChange={onChangeSort}
                choices={[
                  {label: "按路径排序（a-z）", value: "path.a-z"},
                  {label: "按路径排序（z-a）", value: "path.z-a"},
                ]}/>
            </th>
            <th>
              <SortableField text="分类" selectedValue={sort[0]} onChange={onChangeSort}
                choices={[
                  {label: `将${formatSoundCategory(CategoryPrefix.SFX)}置顶`, 
                    visible: sortData["hasSfx"], value: "category.sfx"},
                  {label: `将${formatSoundCategory(CategoryPrefix.MUSIC)}置顶`, 
                    visible: sortData["hasMusic"], value: "category.music"},
                  {label: `将${formatSoundCategory(CategoryPrefix.AMB)}置顶`, 
                    visible: sortData["hasAmb"], value: "category.amb"},
                ]}/>
            </th>
            <th>
              <SortableField text="时长" selectedValue={sort[0]} onChange={onChangeSort}
                choices={[
                  {label: `按时长排序（小到大）`, value: "len.0-9"},
                  {label: `按时长排序（大到小）`, value: "len.9-0"},
                  {label: `将${formatSoundLength(-1)}置顶`, visible: sortData["hasLoop"], value: "len.loop"},
                ]}
            />
            </th>
            <th>
              <SortableField.NoSort text="播放"/>
            </th>
            <th>
              <SortableField text="参数" selectedValue={sort[0]} onChange={onChangeSort}
                choices={[
                  {label: `将无参数置顶`, visible: sortData["hasNoParam"], value: "no-param"},
                  ...sortData.paramNames.map(name=> ({
                    label: `将含有${name}参数置顶`, value: `param-${name}`
                  }))
                ]}
            />
            </th>
            {
              !hideProject && <th>
                <SortableField text="音效包" selectedValue={sort[0]} onChange={onChangeSort}
                  choices={[
                    {label: "按音效包排序（a-z）", value: "project.a-z"},
                    {label: "按音效包排序（z-a）", value: "project.z-a"},
                  ]}/>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          {
            items.map(({id, path, category, lengthms, param_list, project, plain_desc}, i)=>
              i >= range[0] && i <= range[1] && <tr key={id}>
              <td className="max-width-400">
                <PopoverMenu menu={[
                  {icon: "duplicate", text: "拷贝路径", copyText: path},
                  {icon: "link", text: "查看详情", directURL: `/asset?id=${id}`},
                ]}>
                  {path}
                </PopoverMenu>
                <p style={{color: "#aaa"}}>{plain_desc}</p>             
              </td>
              <td>{formatSoundCategory(category)}</td>
              <td>{formatSoundLength(lengthms)}</td>
              <td>
                <PlayIcon path={path} param_list={param_list}/>
              </td>
              <td>
                {param_list.length === 0 && "-"}
                {param_list.map(({name, range})=> <ParamSlider name={name} range={range}/>)}
              </td>
              {
                !hideProject &&
                <td>
                  <PopoverMenu menu={[
                    {icon: "duplicate", text: "拷贝路径", copyText: project},
                    {icon: "link", text: "查看详情", directURL: `/asset?id=fev-${project}`},
                  ]}>
                    {`sound/${project}.fev`}
                  </PopoverMenu>
                </td>
              }
            </tr>)
          }
        </tbody>
      </table>
      <PageTurner {...handler}/>
    </div>
  )
}

const getMusic = ()=>  
  Object.values(window.assets_tag["#music"] || {}) as FmodEvent[]
const getAmibentSound = ()=>
  Object.values(window.assets_tag["#ambient_sound"] || {}) as FmodEvent[]
const getCharacterVoice = ()=>
  Object.values(window.assets_tag["#character_voice"] || {}) as FmodEvent[]

MultiplySoundViewer.Music = ()=> <MultiplySoundViewer soundList={getMusic}/>
MultiplySoundViewer.AmbientSound = ()=> <MultiplySoundViewer soundList={getAmibentSound}/>
MultiplySoundViewer.CharacterVoice = ()=> <MultiplySoundViewer soundList={getCharacterVoice}/>

const FmodProject = (props: {project: string})=> {
  const {project} = props
  const soundList = useCallback(()=> 
    window.assets.allfmodevent.filter(v=> v.project === project)
  , [project])
  return <MultiplySoundViewer soundList={soundList} hideProject/>
}

MultiplySoundViewer.FmodProject = FmodProject