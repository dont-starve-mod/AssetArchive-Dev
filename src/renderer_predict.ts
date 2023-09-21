import Fuse from 'fuse.js'
import smallhash from './smallhash'

export type FuseResult<T> = Fuse.FuseResult<T>

export type AnimationBank = {
  bank: number,
  animation: AnimationInfo[],
}

export type AnimationInfo = {
  name: string,
  facings: number[],
}

export interface PredictableData {
  build: string[],
  animation: AnimationBank[],
  hashmap: [string, number][],
}

export class PredictHelper {
  build: Set<string>
  bank: Map<number, AnimationInfo[]>
  hashmap: Map<number, string>

  buildSearcher: Fuse<{build: string}>
  bankSearcher: Fuse<{bank: string}>
  animationSearcherMap: Map<number, Fuse<{animation: string}>>

  searchOptions: Fuse.IFuseOptions<any> = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.5,
    ignoreLocation: true,
  }

  constructor(data: PredictableData) {
    this.build = new Set(data.build)
    this.bank = new Map(data.animation.map(({bank, animation})=> [bank, animation]))
    this.hashmap = new Map(data.hashmap.map(([k,v])=> [v,k]))

    this.buildSearcher = new Fuse(
      data.build.map((build)=> ({ build })),
      { ...this.searchOptions, keys: ["build"] }
    )

    this.bankSearcher = new Fuse(
      data.animation.map(({bank})=> ({ bank: this.hashmap.get(bank) })),
      { ...this.searchOptions, keys: ["bank"] },
    )

    this.animationSearcherMap = new Map()
  }

  private value(item: Fuse.FuseResult<any>) {
    return item.matches[0].value
  }

  private compareFn(a: Fuse.FuseResult<any>, b: Fuse.FuseResult<any>) {
    if (Math.abs(a.score - b.score) > 1e-6)
      return a.score - b.score
    // if (a.matches[0].indices[0][0] !== b.matches[0].indices[0][0])
    //   return a.matches[0][0] - b.matches[0][0]
    const va: string = this.value(a)
    const vb: string = this.value(b)
    if (va.length !== vb.length)
      return va.length - vb.length
    
    return va === vb ? 0 : va < vb ? -1 : 1
  }

  private sortResult(result: Fuse.FuseResult<any>[]) {
    const MAX = 200
    if (result.length) {
      const bestMatch = result[0]
      if (bestMatch.score < 1e-6) {
        return result.slice(0, MAX)
      }
      else {
        return result.sort((a, b)=> this.compareFn(a, b)).slice(0, MAX)
      }
    }
    else{
      return result
    }
  }

  predictBuild(build: string) {
    const result = this.buildSearcher.search(build)
    return this.sortResult(result)
  }

  predictBank(bank: string) {
    const result = this.bankSearcher.search(bank)
    return this.sortResult(result)
  }

  getAnimationSearcher(bank: string) {
    const hash = smallhash(bank)
    if (this.animationSearcherMap.get(hash))
      return this.animationSearcherMap.get(hash)
    else{
      const data = this.bank.get(hash)
      if (data === undefined)
        return undefined
      const result = new Fuse(data.map(({name})=> name),
        {...this.searchOptions, keys: ["animation"]})
      if (data.length > 50){
        // cache the searcher if item number is huge
        this.animationSearcherMap.set(hash, result)
        return result
      }
      else{
        return result
      }
    }
  }

  predictAnimation(bank: string, animation: string) {
    const searcher = this.getAnimationSearcher(bank)
    if (searcher !== undefined){
      const result = searcher.search(animation)
      return this.sortResult(result)
    }
    return []
  }
}