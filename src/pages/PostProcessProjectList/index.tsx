import React, { useState } from 'react'
import { H3, H5, Icon } from '@blueprintjs/core'
import ProjectSorter from '../../components/ProjectSorter'
import style from './index.module.css'
import Preview from '../../components/Preview'

type Sort = ["title"|"mtime", boolean]
export type PostProcessProject = {
  id: string,
  title?: string,
  desc?: string,
  mediaFilePath?: string,
  filters: any[], //TODO:
  settings: any, // TODO:
}

export default function PostProcessProjectList() {
  const [sortBy, setSorting] = useState<Sort>(["title", false])
  const template: PostProcessProject[] = [
    {
      id: "2123",
      title: "测试1",
      desc: "一年四季",
      filters: [],
      settings: {},
    },

    {
      id: "2",
      title: "测试2",
      desc: "一年四季",
      filters: [],
      settings: {},
    },

    {
      id: "3",
      title: "测试3",
      desc: "一年四季",
      filters: [],
      settings: {},
    },

  ]
  return (
    <div>
      <H3>滤镜渲染器</H3>
      <p>为图片和视频素材添加饥荒风格。</p>
      <div style={{height: 30}}></div>
      <H5>近期的项目<ProjectSorter setSorting={setSorting}/></H5>
      <H5>新建项目</H5>
      <div className={style["template-list"]}>
        <Empty/>
        {
          template.map((item)=> <Template key={item.id} {...item}/>)
        }
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div className={style["template-card-empty"]}>
      <div style={{width: 100, height: 100}}>
        <Icon icon="add" style={{
          color: "#ccc", 
          position: "absolute",
          transform: "translate(-50%, -50%)", 
          left: "50%", top: "50%"}} size={50}/>
      </div>
      <div className={style["template-title"]}>
        <span className="bp4-monospace-text">
          空项目
        </span>
      </div>
    </div>
  )
}

type TemplateProps = PostProcessProject

function Template(props: TemplateProps) {
  const {id, title, desc} = props
  return (
    <div className={style["template-card"]}>
      <div style={{width: 130, height: 100}}>
        <img width={130} height={100} />
      </div>
    </div>
  )
}