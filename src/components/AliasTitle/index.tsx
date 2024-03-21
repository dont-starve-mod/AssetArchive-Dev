const compareFn = (a: string, b: string)=> {
  // eslint-disable-next-line no-control-regex
  const a_ascii = /^[\x00-\x7F]+$/.test(a)
  // eslint-disable-next-line no-control-regex
  const b_ascii = /^[\x00-\x7F]+$/.test(b)
  if (a_ascii !== b_ascii)
    return a_ascii ? 1 : -1
  else
    return a > b ? 1 : -1
}

export function formatAlias(alias: string[], maxWords?: number): string {
  return alias.toSorted(compareFn).slice(0, maxWords || 10).join(" ")
}

export function sortedAlias(alias: string[]): string[] {
  return alias.toSorted(compareFn)
}

export default function AliasTitle(props: {alias: string[]}) {
  return (
    <>
    { formatAlias(props.alias) }
    </>
  )
}