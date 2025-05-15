import { Alert, Button, Dialog, DialogBody, H3, H4, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'

export default function ModAnimAssetList() {
  const [path_list, setPathList] = useState<string[]>([])
  const [preloadResult, setPreloadResult] = useState<any>({successList: [], failedList: [], shown: false})
  const [batchRemoveType, setBatchRemoveType] = useState<"all" | "selected" | "off">("off")

  useEffect(()=> {
    invoke<string[]>("remove_mod_anim_files", {path_list: []}).then(
      setPathList,
    )
  }, [preloadResult.shown, batchRemoveType])

  useEffect(()=> {
    const unlisten = window.listen("refresh_mod_anim_files", ()=> {
      invoke<string[]>("remove_mod_anim_files", {path_list: []}).then(
        setPathList,
      )
    })
    return ()=> { unlisten.then(f=> f()) }
  }, [])

  const addFile = async()=> {
    const path_list = await open({multiple: true, filters: [
      {name: "Zip", extensions: ["zip"]},
      {name: "Binary File", extensions: ["bin"]},
    ]})
    if (path_list) {
      invoke<string[]>("add_mod_anim_files_checked", {path_list}).then(
        result=> {
          let successList = []
          let failedList = []
          result.forEach(v=> {
            let data = JSON.parse(v)
            if (data.success) {
              successList.push(data)
            }
            else {
              failedList.push(data)
            }
          })
          setPreloadResult({successList, failedList, shown: true})
        },
        error=> window.emit("runtime_error", error)
      )
    }
  }

  return (
    <div className='bp4-running-text'>
      <p>在这里添加的动画文件会被加载到渲染器内。
        <Button small icon="plus" onClick={addFile}>添加</Button>
        {/* <Button className='ml-1' small icon="trash" onClick={removeFile}>移除</Button> */}
        <Button disabled={path_list.length === 0} className='ml-1' 
          small icon="trash" onClick={()=> setBatchRemoveType("all")}>清空列表</Button>
      </p>
      {/* <div className='max-h-[400px] overflow-y-auto'> */}
        {
          path_list.map(path=> <File key={path} path={path}/>)
        }
      {/* </div> */}
      <Dialog isOpen={preloadResult.shown} onClose={()=> setPreloadResult({...preloadResult, shown: false})}>
        <DialogBody>
          <H4>加载完成</H4>
          <p>
            {
              `${preloadResult.successList.length}个成功`
            }
            &nbsp;/&nbsp;
            {
              `${preloadResult.failedList.length}个失败`
            }
          </p>
          <div className='h-[200px] overflow-auto p-1
            border-slate-400 border-[1px] border-solid rounded-[3px]
            *:mb-2'>
            {
              preloadResult.successList.map(({path})=> {
                return (
                  <div key={path}>
                    <p>{path} <Tag className='ml-1' intent="success">OK</Tag></p>
                  </div>
                )
              })
            }
            {
              preloadResult.failedList.map(({path, error})=> {
                return (
                  <div key={path}>
                    <p>{path} <Tag className='ml-1' intent="danger">ERROR</Tag></p>
                    <p className='text-red-500 !mt-[-10px]'>{error}</p>
                  </div>
                )
              })
            }
          </div>
        </DialogBody>
      </Dialog>
      <Alert 
        isOpen={batchRemoveType === "all"} 
        intent="danger" 
        icon="trash"
        confirmButtonText="确定"
        cancelButtonText="还是算了"
        onConfirm={()=> {
          invoke("remove_mod_anim_files", {path_list: ["*"]})
          setBatchRemoveType("off")
        }}
        onCancel={()=> setBatchRemoveType("off")}>
        <p>要清空所有外部资源吗？</p>
        <p>该操作不会删除文件。</p>
      </Alert>
    </div>
  )
}

type FileProps = {
  path: string,
}

function File(props: FileProps) {
  const {path} = props
  const strippedPath = path.startsWith(window.home_dir) ? "~" + path.slice(window.home_dir.length) : path
  return (
    <p>
      <Popover2 content={<FileMenu path={path}/>} minimal>
        <a className='py-[4px]'>{strippedPath}</a>
      </Popover2>
    </p>
  )
}

function FileMenu(props: FileProps) {
  const {path} = props
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  return (
    <div className='p-2'>
      {/* <p className='font-bold'>Build</p>
      <p>无</p>
      <p className='font-bold'>Anim</p>
      <p>5个动画</p> */}
      {/* <hr/> */}
      <div className='flex justify-between'>
        <Button small icon="document-open" text="预览"
          onClick={()=> invoke("open_quicklook_windows", {path_list: [path]})}/>
        <Button small icon="folder-open" text="打开文件位置" className='mx-1'
          onClick={()=> invoke("select_file_in_folder", {path})}/>
        <Button small icon="trash" intent="danger" text="移除"
          onClick={()=> setRemoveDialogOpen(true)}/>
      </div>
      <Alert 
        isOpen={removeDialogOpen} 
        intent="danger" 
        icon="trash"
        confirmButtonText="确定"
        cancelButtonText="还是算了"
        onConfirm={()=> invoke("remove_mod_anim_files", {path_list: [path]})
          .then(()=> window.emit("refresh_mod_anim_files"))}
        onCancel={()=> setRemoveDialogOpen(false)}>
        <p>要从渲染器中移除该动画资源吗？</p>
        <p>该操作不会删除文件。</p>
      </Alert>
    </div>
  )
}