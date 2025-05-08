import React, { useCallback, useEffect, useRef, useState, useReducer, useMemo } from 'react'
import { Alert, Button, H3, H5, Icon, PopoverInteractionKind, Radio, RadioGroup, ToastProps } from '@blueprintjs/core'
import { AnimProject, Api, NewAnimProject } from '../../animproject'
import { useLocalStorage, useLuaCall, useLuaCallOnce, useMouseDragClick } from '../../hooks'
import style from './style.module.css'
import { Popover2, Tooltip2 } from '@blueprintjs/popover2'
import { EditableText } from '@blueprintjs/core'
import AnimCore from '../../components/AnimCore_Canvas'
import { AnimState } from '../../components/AnimCore_Canvas/animstate'
import AnimProjectSetter, { AnimProjectSetterAction } from '../../components/AnimProjectSetter'
import { openAnimSubwindow } from './util'
import { RenderParams } from '../../components/AnimCore_Canvas/renderparams'

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
  const [sortBy, setSorting] = useLocalStorage("animlist_sorting")
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
  
  const setOpenId = useCallback((id: string)=> {
    // appWindow.emit("request_opening_project", { id })
    const payload: ToastProps = {
      intent: "success",
      message: "项目创建成功。是否打开？",
      // @ts-ignore
      anim_subwindow_id: id,
    }
    window.emit("toast", payload)
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
  }, {type: "create"}, [setOpenId])
  const change = useLuaCall("animproject", (result: string)=> {
    const data = JSON.parse(result)
    const {project} = data as {project: AnimProject[]}
    setRecent(project)
    window.emit("toast", { message: "修改已保存", icon: "endorsed", intent: "success"})
  }, {type: "change"}, [])
  const duplicate = useLuaCall("animproject", (result: string)=> {
    const data = JSON.parse(result)
    const {new_id, project} = data as {new_id: string, project: AnimProject[]}
    setRecent(project)
    setOpenId(new_id)
  }, {type: "duplicate"}, [setOpenId])

  useLuaCallOnce<string>("animproject", result=> {
    const data = JSON.parse(result)
    const {template, project} = data as {[K: string]: AnimProject[]}
    setRecent(project)
    setTemplate(template)
  }, {type: "list"}, [])

  const sortedProjectList = useMemo(()=> {
    return recent.toSorted((a, b)=> {
      // put invalid field to bottom
      if (a.title === undefined || a.mtime === undefined) return -1
      if (b.title === undefined || b.mtime === undefined) return 1
      switch (sortBy) {
        case "title.a-z":
        case "title.z-a":
          return (a.title.localeCompare(b.title) < 0) === (sortBy === "title.a-z") ? -1 : 1
        case "mtime.9-0":
          return (a.mtime < b.mtime) ? 1 : -1
      }
    })
  }, [sortBy, recent])

  const onChangeTitle = useCallback(({id, title}: {[K: string]: string})=> {
    change({id, title})
  }, [change])
  
  const onChangeDescription = useCallback(({id, description}: {[K: string]: string})=> {
    change({id, description})
  }, [change])

  const onCreate = useCallback(({title, description}: NewAnimProject)=> {
    dispatch({type: "reset"})
    create({title, description})
  }, [create])

  const onDelete = useCallback(({id}: {id: string})=> {
    dispatch({type: "deleted", payload: {id}})
    delete_call({id})
  }, [delete_call])

  const onRequestDeleting = useCallback(({id})=> {
    dispatch({type: "deleting", payload: {id}})
  }, [])

  const onDuplicate = useCallback(({title, description, from_id}: NewAnimProject & { from_id: string })=> {
    dispatch({type: "duplicated", payload: {id: "/"}})
    duplicate({title, description, from_id})
  }, [duplicate])

  const onUseTemplate = useCallback(({title, description, from_id}: NewAnimProject & { from_id: string })=> {
    dispatch({type: "duplicated", payload: {id: "/"}})
    duplicate({title, description, from_id, type: "use_template"})
  }, [duplicate])

  const onRequestDuplicating = useCallback((project: AnimProject)=> {
    dispatch({type: "duplicating", payload: project})
  }, [])

  return (<div>
    <H3>动画渲染器</H3>
    <p>将饥荒动画转换为视频和图片格式。</p>
    <div style={{height: 30}}></div>
    <H5>近期的项目</H5>
    <table className={style["project-list-table"]}>
      <thead className="">
        <th>
          <Popover2 minimal placement="right" content={<div className="sort-popover">
            <RadioGroup selectedValue={sortBy} onChange={e=> setSorting(e.currentTarget.value as typeof sortBy)}>
              <Radio label="按项目名字排序（a-z）" value="title.a-z"></Radio>
              <Radio label="按项目名字排序（z-a）" value="title.z-a"></Radio>
            </RadioGroup>
          </div>}>
            <div style={{cursor: "pointer"}}>
              名字 <Button minimal icon="sort"/>
            </div>
          </Popover2>
        </th>
        <th>
          <Popover2 minimal placement="right" content={<div className="sort-popover">
            <RadioGroup selectedValue={sortBy} onChange={e=> setSorting(e.currentTarget.value as typeof sortBy)}>
              <Radio label="按修改日期排序" value="mtime.9-0"></Radio>
            </RadioGroup>
          </div>}>
            <div style={{cursor: "pointer"}}>
              上次修改 <Button minimal icon="sort"/>
            </div>
          </Popover2>
        </th>
        <th></th>
      </thead>
      <tbody>
        {
          sortedProjectList.map((item, index)=> {
            const {id} = item
            return <tr key={id}>
              <td>
                {item.title || "未命名项目"}
              </td>
              <td className={style["mtime"]}>
                <Mtime mtime={item.mtime}/>
              </td>
              <td>
                <Popover2 
                  disabled={false}
                  content={<AnimProjectPreview {...item}
                    // disable={Boolean(actionState.deleting)}
                    onChangeTitle={(title)=> onChangeTitle({id, title})}
                    onChangeDescription={(description)=> onChangeDescription({id, description})}
                    onRequestDuplicating={(project)=> onRequestDuplicating(project)}
                    onRequestDeleting={()=> onRequestDeleting({id})}
                  />}
                  interactionKind={PopoverInteractionKind.HOVER}
                  hoverCloseDelay={0}
                >
                  <Button icon="open-application" onClick={()=> openAnimSubwindow({id: item.id})}/>
                </Popover2>
                {/* <Button
                  icon="open-application" 
                  style={{marginLeft: 8}}
                  onClick={()=> openAnimSubwindow({id: item.id})}
                /> */}
              </td>
            </tr>
          })
        }
      </tbody>

    </table>
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
    <AnimProjectSetter 
      action={actionName} 
      project={actionProject as AnimProject}
      onClose={()=> dispatch({type: "reset"})}
      onCreate={onCreate}
      onDuplicate={onDuplicate}
      onUseTemplate={onUseTemplate}
    />
    <Alert 
      isOpen={Boolean(actionState.deleting)} 
      intent="danger" icon="trash"
      style={{zIndex: 100, position: "absolute"}}
      confirmButtonText="确定"
      cancelButtonText="还是算了"
      // @ts-ignore deleting id is guaranteed here
      onConfirm={()=> onDelete({id: actionState.deleting.id})}
      onCancel={()=> dispatch({type: "deleting", payload: {id: "/", cancel: true}})}
      >
      <p>真的要删除项目吗？</p>
      <p>该操作<strong>无法撤销</strong>。</p>
    </Alert>
  </div>
  )
}

type AnimProjectItemHandlers = {
  onChangeTitle: (title: string)=> void,
  onChangeDescription: (description: string)=> void,
  onRequestDuplicating: (props: AnimProject)=> void,
  onRequestDeleting: ()=> void,
}

function AnimProjectItem(props: AnimProject & AnimProjectItemHandlers & {disable?: boolean}) {
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

function Mtime(props: {mtime: number}) {
  const [_, forceUpdate] = useReducer(v=> v + 1, 0)
  useEffect(()=> {
    const timer = setInterval(forceUpdate, 60*1000)
    return ()=> clearInterval(timer)
  }, [forceUpdate])

  return (
    <>
      { formatMtime(props.mtime) }
    </>
  )
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

function AnimProjectPreview(props: AnimProject & AnimProjectItemHandlers) {
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
  return (
    <div style={{minWidth: 300, maxWidth: 320, minHeight: 300, position: "relative"}}>
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
        <p className={style["mtime"]}>上次修改: <Mtime mtime={props.mtime}/></p>
        <br/>
        {/* <H5>预览</H5> */}
        <AnimPreview cmds={cmds}/>
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
        <Button icon="open-application" intent="none"
          onClick={()=> openAnimSubwindow({id: props.id})}>打开</Button>
        &nbsp;
        <Button icon="duplicate" intent="none" 
          onClick={()=>props.onRequestDuplicating?.(props)}>复制</Button>
        &nbsp;
        <Button icon="delete" intent="danger" 
          onClick={()=> props.onRequestDeleting?.()}>删除</Button>
      </div>
    </div>
  )
}

function AnimPreview(props: {cmds: Api[]}){
  const {cmds} = props
  const WIDTH = 300, HEIGHT = 250
  const animstate = useRef(new AnimState()).current
  animstate.autoFacing = true

  const render = useRef<RenderParams>()

  useEffect(()=> {
    const onChangeRect = ()=> {
      const {left, right, top, bottom, width, height} = animstate.rect
      const xScale = WIDTH / width
      const yScale = Math.max(0.2, HEIGHT / height)
      const scale = Math.min(0.5, xScale, yScale)
      if (render.current){
        render.current.centerStyle = "origin"
        // @ts-ignore
        render.current.applyPlacement({x: WIDTH/2, y: -top* yScale, scale})
      }
    }
    animstate.addEventListener("changerect", onChangeRect)
    animstate.clear().runCmds(cmds)
    return ()=> animstate.removeEventListener("changerect", onChangeRect)
  }, [cmds, animstate])

  const renderRef = useCallback((v: any)=> {
    render.current = v
  }, [])

  return <AnimCore 
    width={WIDTH} 
    height={HEIGHT} 
    animstate={animstate}
    renderRef={renderRef}
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
  }, [cmds, animstate])

  const [onMouseDown, onMouseUp, isDragClick] = useMouseDragClick()
  const onClickProp = props.onClick
  const onClick = useCallback(()=> {
    if (!isDragClick()){
      onClickProp()
    }
  }, [onClickProp, isDragClick])
  
  return <div className={style["template-card"]} 
    onMouseEnter={()=> animstate.resume()}
    onMouseLeave={()=> animstate.pause()}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    onClick={onClick}
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