import React, { useCallback, useEffect, useMemo, useState } from 'react'
import style from './index.module.css'
import { Button, InputGroup, useHotkeys } from '@blueprintjs/core'
import { AnimState } from '../AnimCore_Canvas/animstate'
import { appWindow } from '@tauri-apps/api/window'
import TinySlider from '../TinySlider'
import { Tooltip2 } from '@blueprintjs/popover2'

interface IProps {
  animstate: AnimState
}

function forceUpdate() {
  appWindow.emit("forceupdate", "AnimPlayerWidget")
}

export default function AnimPlayerWidget(props: IProps) {
  const {animstate} = props
  const player = useMemo(()=> animstate.getPlayer(), [animstate])

  const togglePlaying = useCallback(()=> {
    if (animstate.isPaused)
      animstate.resume()
    else
      animstate.pause()

    forceUpdate()
  }, [animstate])

  const toggleReverse = useCallback(()=> {
    player.reversed = !player.reversed
    forceUpdate()
  }, [animstate])

  const stopPlaying = useCallback(()=> {
    animstate.pause()
    forceUpdate()
  }, [animstate])

  const backward = useCallback(()=> {
    stopPlaying()
    player.step(-1)
    forceUpdate()
  }, [animstate])

  const forward = useCallback(()=> {
    stopPlaying()
    player.step(1)
    forceUpdate()
  }, [animstate])

  const speed2barValue = (v: number)=> {
    // 0.05 .. 1 ..  5
    // 10^-2 .. 10^-1 .. 10^0
    // 0 ...  1 ...2
    if (v > 1)
      return Math.log10((v-5/9)/4*9) + 1
    else
      return Math.log10((v+1/18)/18*19) + 1
  }

  const barValue2speed = (v: number)=> {
    if (v >= 1)
      return Math.pow(10, v-1)* 4/9 + 5/9
    else
      return Math.pow(10, v-1)* 19/18 - 1/18
    // return Math.pow(10, v-2)* 5
  }

  const [invalidValue, setInvalidValue] = useState<string>(undefined)
  const handleInputValue = useCallback((v: string)=> {
    v = v.trim()
    const n = (v ? Number(v) : NaN) / 100
    if (n === n) {
      if (n >= 0.05 && n <= 5) {
        player.speed = n
        setInvalidValue(undefined)
      }
      else {
        player.speed = (Math.max(0.05, Math.min(n, 5)))
        setInvalidValue(v)
      }
    }
    else {
      setInvalidValue(v)
    }
    forceUpdate()
  }, [player])

  useHotkeys([
    {
      label: "play/pause",
      global: true,
      combo: "space",
      preventDefault: true,
      onKeyDown() {
        togglePlaying()
      },
    },
    {
      label: "forward",
      global: true,
      combo: "]",
      preventDefault: true,
      onKeyDown() {
        forward()
      },
    },
    {
      label: "backward",
      global: true,
      combo: "[",
      preventDefault: true,
      onKeyDown() {
        backward()
      },
    },
  ])

  const [frame, setFrame] = useState<string>("")
  const [smoothPercent, setSmoothPercent] = useState<number>(0)

  useEffect(()=> {
    let timer: number = -1
    const update = ()=> {
      setFrame(`${player.currentFrame + 1}/${player.totalFrame}`)
      setSmoothPercent(player.getSmoothPercent())
      timer = requestAnimationFrame(update)
    }
    update()
    return ()=> cancelAnimationFrame(timer)
  }, [player])

  return (
    <div className={style["container"]}>
      <div className={style["bar"]}>
        <div style={{width: 2, height: "100%", position: "absolute", backgroundColor: "#7562d4",
          left: `${smoothPercent* 100}%`}} />
      </div>
      <div className={style["control"]}>
        <div className={style["player-icon-group"]}>
          <Tooltip2 placement="top" content={<span className={style["key-tooltip"]}>上一帧&nbsp;
              <kbd className="bp4-key">{"["}</kbd>
            </span>}>
            <Button icon="step-backward" onClick={backward}/>
          </Tooltip2>
          <Tooltip2 placement="top" content={<span className={style["key-tooltip"]}>播放/暂停&nbsp;
            <kbd className="bp4-key">{"␣"}</kbd>
          </span>}>
            <span>
              {
                animstate.isPlaying && <Button icon="pause" onClick={togglePlaying}/>
              }
              {
                animstate.isPaused && <Button icon="play" onClick={togglePlaying}/>
              }
            </span>
          </Tooltip2>
          <Tooltip2 placement="top" content={<span className={style["key-tooltip"]}>下一帧&nbsp;
            <kbd className="bp4-key">{"]"}</kbd>
          </span>}>
            <Button icon="step-forward" onClick={forward}/>
          </Tooltip2>
          <Tooltip2 placement="top" content={<span
          >切换倒放</span>}>
            <Button icon="double-chevron-right"
              intent={player.reversed ? "warning" : "none"}
              className={[style["reverse-icon"], player.reversed ? style["reverse"] : ""].join(" ")}
              onClick={toggleReverse}/>
          </Tooltip2>
          
        </div>
        <div className={style["frame-setter"]}>
          帧: {frame}
        </div>
        <div className={style["speed-setter"]}>
          <TinySlider min={0} max={2} stepSize={0.01} width={60}
            value={speed2barValue(player.speed)} 
            onChange={v=> {
              player.speed = barValue2speed(v)
              setInvalidValue(undefined)
              forceUpdate()
            }}/>
          <InputGroup
            className={style["number-input"]}
            value={invalidValue || Math.round(player.speed* 100) + ""}
            onChange={(e)=> handleInputValue(e.target.value)}
          />
          &nbsp;%
        </div>
      </div>
    </div>
  )
}
