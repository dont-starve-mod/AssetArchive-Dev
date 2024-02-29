import React from 'react'

export function useHashToString() {
  return (hash: number)=> window.hash.get(hash)
}

export default function Hash({hash}: {hash: number}) {
  let s = window.hash.get(hash)
  return (<>
    {
      typeof s === "string" ? s : ("Hash-" + s)
    }
  </>)
}