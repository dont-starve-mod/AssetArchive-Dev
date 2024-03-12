/*global BigInt*/

const e = new TextEncoder()
const m = new Map()

export default function smallhash(s: number | string): number {
  if (typeof s === "number") return s
  if (m.get(s) !== undefined) return m.get(s)

  const a = e.encode(s.toLowerCase())
  let h = BigInt(0)
  a.forEach(v=> {
    h = (BigInt(v) + BigInt(v >= 128 ? 0xFFFFFF00 : 0) + h* BigInt(65599)) & BigInt(0xFFFFFFFF)
  })
  m.set(s, Number(h))
  return m.get(s)
}