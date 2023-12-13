import React from 'react'
import { Button } from '@blueprintjs/core'

export type ProjectSorterProps = {
  setSorting: ([string, boolean])=> void
}

export default function ProjectSorter(props: ProjectSorterProps) {
  const {setSorting} = props
  return (
    <>
      <Button icon="sort-alphabetical" onClick={()=> setSorting(["title", false])} minimal/>
      <Button icon="sort-alphabetical-desc" onClick={()=> setSorting(["title", true])} minimal/>
      <Button icon="history" onClick={()=> setSorting(["mtime", true])} minimal/>
    </>
  )
}
