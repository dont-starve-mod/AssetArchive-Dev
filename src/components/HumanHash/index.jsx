import React from 'react'

export default function Hash({hash}) {
  let s = window.hash.get(hash)
  if (typeof s === "string") {
    return <>{s}</>
  }
  else {
    return <>HASH-{hash}</>
  }
}
