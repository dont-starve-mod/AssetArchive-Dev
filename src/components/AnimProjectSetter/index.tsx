import React, { useRef, useState } from 'react'
import { AnimProject, NewAnimProject } from '../../animproject'
import { Dialog, DialogBody, DialogFooter, Button, H5, IconName } from '@blueprintjs/core'
import { InputGroup, TextArea } from '@blueprintjs/core'

type IdleProps = {
  action: "none"
}

type CreateProps = {
  action: "create",
  onCreate: (param: NewAnimProject)=> unknown
}

type UseTemplateProps = {
  action: "use_template",
  project: AnimProject,
  onUseTemplate: (param: NewAnimProject & { from_id: string })=> unknown
}

type DuplicateProps = {
  action: "duplicate",
  project: AnimProject,
  onDuplicate: (param: NewAnimProject & { from_id: string })=> unknown
}

export type AnimProjectSetterAction = (IdleProps | CreateProps | DuplicateProps | UseTemplateProps)["action"]
type IProps = (IdleProps | CreateProps | DuplicateProps | UseTemplateProps) & {onClose: Function}
export default function AnimProjectSetter(props: IProps) {
  const {action} = props
  const title = 
    action === "create" ? "创建空项目" :
    action === "duplicate" ? "复制项目" : 
    action === "use_template" ? "从模板创建项目" : null 
  const icon: IconName | null = 
    action === "create" ? "add" :
    action === "duplicate" ? "duplicate" :
    action === "use_template" ? "document-share" : null
    if (action === "none") return <></>
  const project = action !== "create" && props.project
  const oldProjectTitle = project && project.title
  const defaultProjectTitle = 
    action === "duplicate" ? (oldProjectTitle ? oldProjectTitle + " 的副本" : undefined) :
    action === "use_template" ? oldProjectTitle : null
  const oldDescription = project && project.description
  const defaultProjectDescription = 
    action === "duplicate" ? oldDescription :
    action === "use_template" ? (oldDescription ? oldDescription + "\n\n" : "") + "来自模板: " + oldProjectTitle : null

  const titleRef = useRef<HTMLInputElement|null>(null)
  const descRef = useRef<HTMLTextAreaElement|null>(null)
  const [hasTitle, setHasTitle] = useState(false)

  const onConfirm = ()=> {
    const title = (titleRef.current as HTMLInputElement).value
    const description = (descRef.current as HTMLTextAreaElement).value
    const param: NewAnimProject = {title, description}
    switch (action){
      case "create":
        props.onCreate(param)
        return
      case "duplicate":
        props.onDuplicate({ ...param, from_id: project.id })
        return
      case "use_template":
        props.onUseTemplate({ ...param, from_id: project.id })
        return
    }
  }

  return (
    <Dialog title={title} icon={icon} style={{width: 400}} 
      canEscapeKeyClose={false}
      canOutsideClickClose={false}
      onClose={()=> props.onClose()}
      isOpen>
      <DialogBody>
        <H5>名字</H5>
        <InputGroup
          inputRef={ref=> {ref?.focus(); titleRef.current = ref}}
          placeholder={action === "create" ? "给新项目取个名字吧..." : "输入项目名字..."}
          style={{marginBottom: 20}} 
          maxLength={100}
          defaultValue={typeof defaultProjectTitle === "string" ? defaultProjectTitle : undefined}
          onChange={(v)=> setHasTitle(Boolean(v.target.value))}
        />
        <H5>描述</H5>
        <TextArea 
          inputRef={descRef}
          placeholder={action === "create" ? "写一段简短的介绍，也可以空着..." : "输入描述..."}
          fill 
          growVertically={false} 
          style={{height: 100, resize: "none"}} 
          maxLength={1000}
          defaultValue={typeof defaultProjectDescription === "string" ? defaultProjectDescription : undefined}
        />
      </DialogBody>
      <DialogFooter minimal actions={
        <>
          <Button intent="none" text="取消" onClick={()=> props.onClose()}/>
          <Button intent="primary" text="确认" onClick={onConfirm} disabled={action === "create" && !hasTitle}/>
        </>
      }/>
    </Dialog>
  )
}
