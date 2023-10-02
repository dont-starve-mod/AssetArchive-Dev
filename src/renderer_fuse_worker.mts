import * as Comlink from "comlink"
import Fuse from "fuse.js"

type Options = Pick<Fuse.IFuseOptions<string>, "isCaseSensitive">
type Payload = {
  items: string[],
  options?: Options,
}

// a simple fuse worker process, data provided dynamically
export const search = (query: string, payload: Payload)=> {
  const {items, options} = payload
  let fuse = new Fuse(items, { includeMatches: true, ...options})
  return fuse.search(query)
}

Comlink.expose({
  search
})