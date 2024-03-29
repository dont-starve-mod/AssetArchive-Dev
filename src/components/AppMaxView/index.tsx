import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStates, useCopyTexElement, useLuaCallOnce, useSaveFileCall, useSaveFileDialog } from '../../hooks'
import { Button, Overlay, Spinner } from '@blueprintjs/core'
import { base64DecToArr } from '../../base64_util'
import { v4 } from 'uuid'
import style from './index.module.css'

export default function AppMaxView() {
  const [openData, setOpenData] = useAppStates("max_view_open")
  const {uid, index} = openData
  const data = window.max_view_data[uid]
  const {type, items} = data || {}
  const close = ()=> setOpenData({uid: "", index: NaN})
  return (
    <Overlay
      isOpen={!isNaN(index)}
      onClose={()=> close()}
      transitionDuration={40}>
      <div className="w-full h-full flex justify-center items-center"
        onClick={()=> close()}>
        {
          type === "tex" && <TexView key={index} items={items || []} index={index}/>
        }
      </div>
    </Overlay>
  )
}

function TexView(props: {items: any[], index: number}){
  const {items, index} = props
  const item = items[index]
  const {xml, tex} = item || {xml: "", tex: ""}
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawData, setDrawData] = useState<[number, number, ImageBitmap]>([0, 0, undefined])

  // TODO: performance optimization
  useLuaCallOnce<string>("load", async response=> {
    const {width, height, rgba} = JSON.parse(response)
    const pixels = base64DecToArr(rgba)
    const data = new ImageData(pixels, width, height)
    const img = await createImageBitmap(data)
    setDrawData([width, height, img])
    setLoading(false)
  }, {tex, xml, type: "image", format: "json"}, [tex, xml])

  useEffect(()=> {
    if (drawData[0]) {
      let ctx = canvasRef.current.getContext("2d")
      ctx.drawImage(drawData[2], 0, 0)
    }
  }, [drawData])

  const canPrev = useCallback(()=> {
    return index > 0
  }, [index])

  const canNext = useCallback(()=> {
    return index < items.length - 1
  }, [index, items])

  const [data, setOpenData] = useAppStates("max_view_open")
  const setIndex = useCallback((index: number)=> 
    setOpenData({uid: data.uid, index})
  , [data, setOpenData])

  const prev = useCallback((e: React.MouseEvent)=> {
    e.stopPropagation()
    setIndex(Math.max(0, index - 1))
  }, [index, setIndex])

  const next = useCallback((e: React.MouseEvent)=> {
    e.stopPropagation()
    setIndex(Math.min(items.length - 1, index + 1))
  }, [index, setIndex, items.length])

  useEffect(()=> {
    const onKeyUp = (e: KeyboardEvent)=> {
      const {key} = e
      if ((key === "ArrowLeft" || key === "[") && canPrev()) 
        prev(e as any)
      else if ((key === "ArrowRight" || key === "]") && canNext()) 
        next(e as any)
    }
    window.addEventListener("keyup", onKeyUp)
    return ()=> window.removeEventListener("keyup", onKeyUp)
  }, [canPrev, canNext, prev, next])

  const buttonStyle: React.CSSProperties = {
    color: "#eee",
    top: "50%",
    transform: "scale(1.5)",
  }

  const copy = useCopyTexElement(xml, tex)
  const download = useSaveFileCall({xml, tex, type: "image"}, "image", tex, [xml, tex])

  return (
    <>
      {
        loading && <Spinner className={style["white"]}/>
      }
      <canvas
        className={loading ? "bp4-skeleton" : undefined}
        ref={canvasRef}
        width={drawData[0]} height={drawData[1]}
        style={{maxWidth: "80vw", maxHeight: "80vh", zoom: 2.5,
          filter: loading ? "blur(4px)" : "none"}}
      />
      <Button minimal className={style["white-icon"]} icon="chevron-left" intent="primary" onClick={prev} style={{
        ...buttonStyle,
        position: "fixed",
        top: "50%",
        cursor: canPrev() ? "pointer" : "not-allowed",
        left: 8}}/>
      <Button minimal className={style["white-icon"]} icon="chevron-right" intent="primary" onClick={next} style={{
        ...buttonStyle,
        position: "fixed",
        top: "50%",
        cursor: canNext() ? "pointer" : "not-allowed",
        right: 8}}/>
      <div className="fixed bottom-0 left-1/2 mb-8 p-2 backdrop-blur-sm" 
        style={{transform: "translateX(-50%)", backgroundColor: "#fff2", borderRadius: 2}}>
        <Button minimal icon="duplicate"intent="primary" className={style["white-icon"]} style={buttonStyle}
          onClick={e=> [copy(), e.stopPropagation()]}/>
        <div className="inline-block w-4"/>
        <Button minimal icon="download" intent="primary" className={style["white-icon"]} style={buttonStyle}
          onClick={e=> [download(), e.stopPropagation()]}/>
      </div>
    </>
  )
}

// NOTE: assign max view data to window instead of redux
export function usePushItemsToMaxView<T>(type: string, items: T[]){
  const uid = useRef(v4()).current

  const allData = window.max_view_data
  if (allData[uid] === undefined ||
    allData[uid].type !== type ||
    allData[uid].items !== items) {
    allData[uid] = {type, items}
  }

  return uid
}

// export function usePushItemsToMaxView<T>(type: string, items: T[]){
//   const uid = useRef(()=> v4())
//   const [data, setData] = useAppStates("max_view_data")
//   console.log("trigger hook on reder")

//   useEffect(()=> {
//     // @ts-ignore
//     if (data.items === items) return
//     console.log("On deiff", items.length, "-> ", data.items.length)
//     switch(type) {
//       case "tex":
//         // @ts-ignore
//         if (items.every(v=> v.xml && v.tex)) setData({type: "tex", items})
//         break
//       default:
//         throw Error("unknown type: " + type)
//     }

//   }, [type, items, setData, data])
// }