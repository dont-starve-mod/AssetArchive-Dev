import { LRUCache } from "lru-cache"
import { useEffect, useRef } from "react"

type capacityChoice = "default" | "smaller" | "bigger" | "max" | "disable"

interface ICacheCapacityProfile {
  searchPage: number,
  assetPage: number,
}

type pageCacheNameSpace = keyof ICacheCapacityProfile

const CAPACITY: {[K in capacityChoice]: ICacheCapacityProfile} = {
  default: {
    searchPage: 4,
    assetPage: 20,
  },
  smaller: {
    searchPage: 1,
    assetPage: 5,
  },
  bigger: {
    searchPage: 10,
    assetPage: 40,
  },
  max: {
    searchPage: 10,
    assetPage: 100,
  },
  disable: {
    searchPage: -1,
    assetPage: -1,
  },
}

export class ResizableCache extends LRUCache<string, any> {
  // private _size: number
  private _capacity: number
  private _onDeleteItems? = (items: string[])=> {}

  constructor(max: number) {
    super({max: 9999})
    // this._size = 0
    this._capacity = max
  }
  setOnDeleteItemsFn(fn: (item: string[])=> any) {
    this._onDeleteItems = fn
  }

  checkCapacity() {
    console.log("check:", this.size, this._capacity)
    let results: string[] = []
    if (this._capacity > 0 && this.size > this._capacity){
      const keys = this.rkeys()
      for (let k of keys) {
        if (this.delete(k))
          results.push(k)
        if (this.size < this._capacity)
          break
      }
    }
    if (results.length > 0 && this._onDeleteItems){
      this._onDeleteItems(results)
    }
  }

  set(k: string, v: any, setOptions?: LRUCache.SetOptions<string, any, unknown> | undefined): this {
    console.log("set", k, v)
    super.set(k, v, setOptions)
    this.checkCapacity()
    return this
  }

  resize(max: number) {
    console.log("call resize!", this._capacity, '->', this.max)
    console.log("cur size: ",this.size)
    this._capacity = max
    this.checkCapacity()
  }

  get capacity() {
    return this._capacity
  }
}

// const cache: {[K in pageCacheNameSpace]: ResizableCache} = {
//   searchPage: new ResizableCache(9999),
//   assetPage: new ResizableCache(9999),
// }

// export function setCacheCapacity(name: capacityChoice) {
//   Object.entries(cache).forEach(([type, cache])=> {
//     cache.resize(CAPACITY[name][type])
//   })
// }

export function usePageCache(nameSpace: pageCacheNameSpace, deleteFn?: any) {
  const max = CAPACITY["default"][nameSpace] && 1 /* TODO: use redux */
  const cache = useRef(new ResizableCache(max)).current
  cache.setOnDeleteItemsFn(deleteFn)
  return { cache }
}

export function useCacheCapacity(nameSpace: pageCacheNameSpace, profile: capacityChoice) {
  return CAPACITY[profile][nameSpace]
}

export { capacityChoice, pageCacheNameSpace }
// export default cache