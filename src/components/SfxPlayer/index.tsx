import React, { useCallback, useEffect } from 'react'
import style from './index.module.css'
import { Button, Menu, MenuItem, Tag } from '@blueprintjs/core'
import { FmodEventInfo } from '../AppFmodHandler'
import TinySlider from '../TinySlider'
import { Popover2 } from '@blueprintjs/popover2'
import { invoke } from '@tauri-apps/api/core'
import { useSelector } from '../../redux/store'
import { useCopySuccess, useLocalStorage } from '../../hooks'
import { writeText } from '../../clipboard'

export default function SfxPlayer(props: FmodEventInfo & {sfxId?: string}) {
  const {path, param_list} = props
  const {sfxId = "SFX_PLAYER_DEFAULT"} = props
  const [fmod_param_value] = useLocalStorage("fmod_param_value")
  const play = useCallback(()=> {
    const params = Object.fromEntries(
      param_list.map(({name, range})=> {
        const {[name]: percent = 0.5} = fmod_param_value
        return [name, range[0] + (range[1]-range[0])*percent]
      })
    )
    invoke("fmod_send_message", { data: JSON.stringify({
      api: "PlaySoundWithParams",
      args: [path, sfxId, params],
    })})
  }, [path, sfxId, param_list, fmod_param_value])

  const stop = useCallback(()=> {
    invoke("fmod_send_message", { data: JSON.stringify({
      api: "KillSound",
      args: [sfxId],
    })})
  }, [sfxId])

  useEffect(()=> {
    // stop playing on path changed
    stop()
    // stop playing on component unmounted
    return ()=> stop()
  }, [sfxId, path, stop])

  const playingInfo = useSelector(({appstates})=> appstates.fmod_playing_info)[sfxId]
  const isPlaying = playingInfo && playingInfo.playing
  const paramList = playingInfo && playingInfo.param_list

  return (
    <div style={{display: "inline-block"}}>
      <div className={style["box"]}>
        <div className={style["icon"]}>
          <Button 
            large intent="primary"
            icon={isPlaying ? "stop" : "play"}
            onClick={()=> {isPlaying ? stop() : play()}}/>
        </div>
        <div className={style["sep"]}/>
        {
          param_list.length === 0 && "无参数" 
        }
        {
          param_list.map((param, index)=> 
            <>
              {
                index > 0 && <div className={style["sep"]}/>
              }
              <ParamSetter key={index}
                {...param} sfxId={sfxId} paramList={paramList}/>
            </>
          )
        }
      </div>
    </div>
  )
}

type ParamSetterProps = {
  name: string,
  range: [number, number]
}

function ParamSetter(props: ParamSetterProps & {sfxId: string, paramList: any[]}) {
  const {name, range, sfxId} = props
  const [fmod_param_value, setParam] = useLocalStorage("fmod_param_value")

  const onChange = useCallback((percent: number)=> {
    const value = range[0] + (range[1]-range[0])* percent
    setParam({...fmod_param_value, [name]: percent})
    invoke("fmod_send_message", { data: JSON.stringify({
      api: "SetParameter",
      args: [sfxId, name, value],
    })})
  }, [name, range, fmod_param_value, setParam, sfxId])

  const param = props.paramList && props.paramList.find(v=> v.name === name)
  const current = param ? param.current.toFixed(2) : "-"
  const {[name]: percent = 0.5} = fmod_param_value

  return (
    <div className={style["param"]}>
      <p>
        <Popover2 minimal placement="right"
          content={<ParamInfo {...props} current={current}/>}>
          <Tag minimal interactive>
            {props.name}
          </Tag>
        </Popover2>
      </p>
      <div className={style["slider"]}>
        <TinySlider
          min={0} max={1} stepSize={0.01}
          value={percent} onChange={onChange}/>
      </div>
    </div>
  )
}

function ParamInfo(props: ParamSetterProps & {current: any}) {
  const onSuccess = useCopySuccess()
  return (
    <Menu>
      <MenuItem icon="duplicate" text="拷贝参数名"
        onClick={()=> writeText(props.name).then(()=> onSuccess())}/>
    </Menu>
  )
  // return (
  //   <div style={{width: 200}}>
  //     <strong>{props.name}</strong>
  //     {/* <Button icon="duplicate" minimal /> */}
  //     <hr/>
  //     <p>范围：{props.range[0]}–{props.range[1]}</p>
  //     <p>当前：{props.current}</p>
  //   </div>
  // )
}