import React from 'react'

type BackgroundProps = {
  width: number,
  height: number,
  backgroundStyle?: "solid" | "grid",
  backgroundColor?: string,
  className?: string,
  style?: React.CSSProperties,
  children?: React.ReactNode,
}

const gridStyle: React.CSSProperties = {
  backgroundImage: "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)",
  backgroundColor: "#555",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 8px 8px",
}

export function useBackgroundStyle(style: "solid" | "grid", color?: string) {
  switch (style) {
    case "grid":
      color = color || gridStyle["backgroundColor"]
      return {...gridStyle, backgroundColor: color}
    case "solid":
      return {backgroundColor: color}
  }
}

export default function Background(props: BackgroundProps) {
  const {width, height, backgroundStyle, backgroundColor} = props
  const style = useBackgroundStyle(backgroundStyle, backgroundColor)
  return (
    <div
      style={{
        width, height,
        ...style,
        ...props.style}} 
      className={props.className}
    >
      {props.children}
    </div>
  )
}
