import React, { useCallback, useEffect, useRef, useState, useReducer, useMemo } from 'react'
import { Alert, Button, ButtonGroup, Card, H3, H5, Icon, PopoverInteractionKind, ToastProps } from '@blueprintjs/core'
import { AnimProject, Api, NewAnimProject } from '../../animproject'
import { useLuaCall, useLuaCallOnce } from '../../hooks'
import style from './style.module.css'
import { Popover2 } from '@blueprintjs/popover2'
import { EditableText } from '@blueprintjs/core'
import AnimCore from '../../components/AnimCore_Canvas'
import { invoke } from '@tauri-apps/api'
import { appWindow } from '@tauri-apps/api/window'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import AnimProjectSetter, { AnimProjectSetterAction } from '../../components/AnimProjectSetter'
import { openAnimSubwindow } from './util'

// TODO: 在执行后端操作（删除/创建/复制）时，按钮应显示为loading
// 完成操作后，再移除model

type Action = {
  type: "templating" | "creating" | "duplicating" | "duplicated" | "deleting" | "deleted",
  payload: {
    id: string,
    cancel?: true,
  },
}

type ResetAction = {
  type: "reset",
}

type State = {
  deleting?: { id: string },
  duplicating?: AnimProject,
  templating?: AnimProject,
  creating?: NewAnimProject,
}

const actionReducer: React.Reducer<State, Action | ResetAction> = (state, action) => {
  if (action.type === "reset")
    return {}

  const {payload} = action
  switch (action.type){
    case "creating":
      return { creating: payload as NewAnimProject }
    case "duplicating":
      return { duplicating: payload as AnimProject}
    case "duplicated":
      return {}
    case "templating":
      return { templating: payload as AnimProject }
    case "deleting":
      if (payload.cancel)
        return {}
      else 
        return { deleting: { id: payload.id } }
    case "deleted":
      return {}
    default:
      return state
  }
}

export default function AnimListPage() {
  const [recent, setRecent] = useState<AnimProject[]>([])
  const [sortBy, setSorting] = useState<["title" | "mtime", boolean]>(["title", false])
  const [template, setTemplate] = useState<AnimProject[]>([])
  const [actionState, dispatch] = useReducer(actionReducer, {})
  const actionName: AnimProjectSetterAction = 
    actionState.duplicating !== undefined ? "duplicate" :
    actionState.creating !== undefined ? "create" :
    actionState.templating !== undefined ? "use_template" :
    "none"
  const actionProject: AnimProject | null = 
    actionState.duplicating !== undefined ? actionState.duplicating :
    actionState.templating !== undefined ? actionState.templating :
    null
  
  const openProject = useCallback((id: string)=> {
    openAnimSubwindow({id})
  }, [])
  
  const setOpenId = useCallback((id: string)=> {
    // appWindow.emit("request_opening_project", { id })
    const payload: ToastProps = {
      intent: "success",
      message: "项目创建成功。是否打开？",
      action: {
        icon: "document-open",
        // text: "打开"
        onClick: ()=> openProject(id),
      }
    }
    appWindow.emit("toast", payload)
  }, [])

  const delete_call =  useLuaCall("animproject", (result: string)=> {
    const data = JSON.parse(result)
    const {project} = data as {project: AnimProject[]}
    setRecent(project)
  }, {type: "delete"}, [])
  const create = useLuaCall("animproject", (result: string)=> {
    const data = JSON.parse(result)
    const {new_id, project} = data as {new_id: string, project: AnimProject[]}
    setRecent(project)
    setOpenId(new_id)
  }, {type: "create"}, [])
  const change = useLuaCall("animproject", (result: string)=> {
    const data = JSON.parse(result)
    const {project} = data as {project: AnimProject[]}
    setRecent(project)
    appWindow.emit("toast", { message: "修改已保存", icon: "endorsed", intent: "success"})
  }, {type: "change"}, [])
  const duplicate = useLuaCall("animproject", (result: string)=> {
    const data = JSON.parse(result)
    const {new_id, project} = data as {new_id: string, project: AnimProject[]}
    setRecent(project)
    setOpenId(new_id)
  }, {type: "duplicate"}, [])

  useLuaCallOnce<string>("animproject", result=> {
    const data = JSON.parse(result)
    const {template, project} = data as {[K: string]: AnimProject[]}
    setRecent(project)
    setTemplate(template)
  }, {type: "list"}, [])

  const sortedProjectList = useMemo(()=> {
    const [by, reversed] = sortBy
    const cmp = (a: AnimProject, b: AnimProject)=> {
      if (a[by] === b[by]) return 0
      else if (a[by] !== undefined && b[by] === undefined) return 1
      else if (a[by] === undefined && b[by] !== undefined) return -1
      // @ts-ignore
      else return a[by] < b[by] ? -1 : 1
    }
    return Array.from(recent).sort((a, b)=> cmp(a, b) * (reversed ? -1 : 1))
  }, [sortBy, recent])

  const onChangeTitle = useCallback(({id, title}: {[K: string]: string})=> {
    change({id, title})
  }, [])
  
  const onChangeDescription = useCallback(({id, description}: {[K: string]: string})=> {
    change({id, description})
  }, [])

  const onCreate = useCallback(({title, description}: NewAnimProject)=> {
    dispatch({type: "reset"})
    create({title, description})
  }, [])

  const onDelete = useCallback(({id}: {id: string})=> {
    dispatch({type: "deleted", payload: {id}})
    delete_call({id})
  }, [])

  const onRequestDeleting = useCallback(({id})=> {
    dispatch({type: "deleting", payload: {id}})
  }, [])

  const onDuplicate = useCallback(({title, description, from_id}: NewAnimProject & { from_id: string })=> {
    dispatch({type: "duplicated", payload: {id: "/"}})
    duplicate({title, description, from_id})
  }, [])

  const onUseTemplate = useCallback(({title, description, from_id}: NewAnimProject & { from_id: string })=> {
    dispatch({type: "templating", payload: {id: "/"}})
    duplicate({title, description, from_id, type: "use_template"})
  }, [])

  const onRequestDuplicating = useCallback((project: AnimProject)=> {
    dispatch({type: "duplicating", payload: project})
  }, [])

  return (<div>
    <H3>动画渲染器</H3>
    <p>将饥荒动画转换为视频和图片格式。</p>
    <div style={{height: 30}}></div>
    <Button onClick={()=> openAnimSubwindow({id: "test"})}>测试1</Button>
    <H5>近期的项目
    <Button icon="sort-alphabetical" onClick={()=> setSorting(["title", false])} minimal></Button>
    <Button icon="sort-alphabetical-desc" onClick={()=> setSorting(["title", true])} minimal></Button>
    <Button icon="history" onClick={()=> setSorting(["mtime", true])} minimal/>
    </H5>
    <div className={style["recent-project-list"]}>
      {
        sortedProjectList.map((item, index)=> {
          const {id} = item
          return <div key={index}>
            <AnimProjectItem {...item}
              disable={Boolean(actionState.deleting)}
              onChangeTitle={(title)=> onChangeTitle({id, title})}
              onChangeDescription={(description)=> onChangeDescription({id, description})}
              onRequestDuplicating={(project)=> onRequestDuplicating(project)}
              onRequestDeleting={()=> onRequestDeleting({id})}
            />
          </div>
        })
      }
    </div>
    <div style={{height: 20}}></div>
    <H5>新建项目</H5>
    <div className={style["template-list"]}>
      <Empty onClick={()=> dispatch({type: "creating", payload: {} as any})}/>
      {
        template.map((item, index)=> {
          const {id} = item
          return <div key={index} id={id}>
            <Template {...item} onClick={()=> dispatch({type: "templating", payload: item})}/>
          </div>
        })
      }
    </div>
    <AnimProjectSetter action={actionName} project={actionProject as AnimProject}
      onClose={()=> dispatch({type: "reset"})}
      onCreate={onCreate}
      onDuplicate={onDuplicate}
      onUseTemplate={onUseTemplate}
    />
    <Alert isOpen={Boolean(actionState.deleting)} intent="danger" icon="trash"
      style={{zIndex: 100}}
      confirmButtonText="确定"
      cancelButtonText="还是算了"
      // @ts-ignore deleting id is guaranteed here
      onConfirm={()=> onDelete({id: actionState.deleting.id})}
      onCancel={()=> dispatch({type: "deleting", payload: {id: "/", cancel: true}})}
      >
      <p>你真的要删除项目吗？该操作<strong>无法撤销</strong>。</p>
      <p style={{color: "#aaa", fontStyle: "oblique"}}>回档也救不了你。</p>
    </Alert>
  </div>
  )
}

interface IAnimProjectItemHandlers {
  onChangeTitle: (title: string)=> void,
  onChangeDescription: (description: string)=> void,
  onRequestDuplicating: (props: AnimProject)=> void,
  onRequestDeleting: ()=> void,
}

function AnimProjectItem(props: AnimProject & IAnimProjectItemHandlers & {disable?: boolean}) {
  const {title, id} = props
  const openProject = ()=> openAnimSubwindow({id})
  return <div className={style["recent-project-item"]}>
    <span className={style["link"]} onClick={openProject}>{title || "未命名项目"}</span>
      <Popover2 
        disabled={props.disable}
        content={<AnimProjectPreview {...props}/>}
        interactionKind={PopoverInteractionKind.HOVER}
        hoverCloseDelay={0}
      >
        <Button icon="zoom-in" intent="primary" className={style["edit-icon"]} minimal={true} small={true}/>
      </Popover2>
    </div>
}

const formatMtime = (mtime?: number): string=> {
  if (typeof mtime === "number"){
    const current = new Date()
    const past = new Date(mtime* 1000)
    const dt = (current.getTime() - past.getTime()) / 1000
    if (dt < 3600)
      return Math.floor(dt/60) + "分钟前"
    else
      return past.toLocaleString()
  }
  else {
    return "未知"
  }
}

function AnimProjectPreview(props: AnimProject & IAnimProjectItemHandlers) {
  const {title, description, cmds} = props
  const [isInputFocus, setInputFocus] = useState(false)
  const backdropStyle: React.CSSProperties = {
    width: isInputFocus ? 10000: "calc(100% + 50px)",
    height: "calc(100% + 50px)",
    zIndex: -1,
    position: "absolute",
    left: -isInputFocus ? -5000: -25,
    top: -25,
    // backgroundColor: "#a00a",
  }
  return <div style={{minWidth: 300, minHeight: 300, position: "relative"}}>
    <div style={backdropStyle}></div>
    <div className={style["popover-content"]}>
      <H5>
        <EditableText 
          placeholder="输入项目名字..." 
          maxLength={100} 
          defaultValue={title}
          onEdit={()=> setInputFocus(true)}
          onConfirm={(value)=> {
            setInputFocus(false)
            if (value !== title)
              props.onChangeTitle?.(value)
          }}
        />
      </H5>
      <p className={style["mtime"]}>上次修改: {formatMtime(props.mtime)}</p>
      <hr/>
      <AnimCanvas cmds={cmds}/>
      <div style={{height: 10}}></div>
      <EditableText 
        multiline={true} 
        placeholder="输入描述..." 
        maxLength={1000}
        maxLines={5}
        defaultValue={description}
        onEdit={()=> setInputFocus(true)}
        onConfirm={(value)=> {
          setInputFocus(false) 
          if (value !== description)
            props.onChangeDescription?.(value)
        }}
      />
      <div style={{height: 20}}></div>
      <Button icon="duplicate" intent="none" 
        onClick={()=>props.onRequestDuplicating?.(props)}>复制</Button>
      &nbsp;
      <Button icon="delete" intent="danger" 
        onClick={()=> props.onRequestDeleting?.()}>删除</Button>
    </div>
  </div>
}

function AnimCanvas(props: {cmds: Api[]}){
  const {cmds} = props
  const animstate = useRef(new AnimState()).current
  animstate.autoFacing = true

  useEffect(()=> {
    animstate.clear().runCmds(cmds)
  }, [cmds])

  return <AnimCore 
    width={300} 
    height={250} 
    animstate={animstate}
    globalScale={0.5}
    bgc="#aaa"
  />
}

function Empty(props: {onClick: Function}){
  return <div className={[style["template-card"], style["template-card-empty"]].join(" ")}
    onClick={()=> props.onClick()}>
    <div style={{width: 100, height: 100}}>
      <Icon icon="add" style={{
        color: "#ccc", 
        position: "absolute",
        transform: "translate(-50%, -50%)", 
        left: "50%", top: "50%"}} size={50}/>
    </div>
    <div className={style["grid-name"]}>
      <span className="bp4-monospace-text">
        空项目
      </span>
    </div>
  </div>
}

function Template(props: AnimProject & {onClick: Function}){
  const {title, cmds} = props
  const animstate = useRef(new AnimState()).current
  animstate.autoFacing = true

  useEffect(()=> {
    animstate.clear().runCmds(cmds)
    animstate.pause()
  }, [cmds])

  return <div className={style["template-card"]} 
    onMouseEnter={()=> animstate.resume()}
    onMouseLeave={()=> animstate.pause()}
    onClick={()=> props.onClick()}
    >
      <AnimCore width={100} height={100} 
        animstate={animstate} 
        globalScale={0.25} defaultScale={props.preview_scale}
        axis="none" bgc="#ddd" centerStyle="bottom"/>
      <div className={style['grid-name']}>
        <span className="bp4-monospace-text">
          模板: {title}
        </span>
      </div>
  </div>
}