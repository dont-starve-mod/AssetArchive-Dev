function workerScript() {
/* start of script */

self.assets = {}

function getSubSeq(str, needle, wholeWord = false){
  str = str.toLowerCase()
  const L1 = str.length
  const L2 = needle.length
  let i = 0, j = 0
  let match = new Array(L2)

  if (L2 > L1) return
  if (wholeWord){
    i = str.indexOf(needle)
    if (i === -1) return

    for (let k = 0; k < L2; ++k){
      match[k] = i + k
    }
    match.span = L2
    return match
  }
  let minSpan = L1 + 1
  let minMatch = null
  while (i < L1 && j < L2){
    i = str.indexOf(needle[j], i)
    if (i !== -1){
      j++
      if (j === L2){
        // match to the end, now go back
        i += 1
        for (let k = L2 - 1; k >= 0; --k){
          i = str.lastIndexOf(needle[k], i - 1)
          match[k] = i
        }
        j = 0
        const span = match[L2 - 1] - match[0]
        if (span < minSpan){
          minSpan = span
          minMatch = [...match]
          minMatch.span = span
          if (span === L2) return minMatch
        }
      }
    i++
    }
    else{
      break
    }
  }
  return minMatch
}

function bestMatch(matches) {
  let minSpan = 114*514
  let minStart = minSpan
  let match = null
  let key = null
  Object.entries(matches).forEach(([k,m])=> {  
    if (m.span < minSpan || m.span === minSpan && m[0] < minStart){
      minSpan = m.span
      minStart = m[0]
      match = m
      key = k
    }
  })
  return [match, key]
}

function Search(str, wholeWord) {
  const result = []

  // asset search
  const FIELDS = ["file", "xml", "tex", "texname", "desc"]
  Object.keys(self.assets).forEach(k=> {
    self.assets[k].forEach(asset=> {
      let matches = {}
      let hit = false
      FIELDS.forEach(field=> {
        if (asset[field] !== undefined){
          let match = getSubSeq(asset[field], str, wholeWord)
          if (match) {
            matches[field] = match
            hit = true
          }
        } 
      })
      if (hit) {
        result.push({
          ...asset,
          matches,
        })
      }
    })
  })

  const KEY_PRIORITY = {
    file: 1,
    xml: .95,
  }

  result.sort((a, b)=> {
    let [am, ak] = bestMatch(a.matches)
    let [bm, bk] = bestMatch(b.matches)

    if (am.span !== bm.span){
      return am.span - bm.span
    }
    else if (am[0] !== bm[0]){
      return am[0] - bm[0]
    }
    else if (ak !== bk) {
      return - am.span * (KEY_PRIORITY[ak] || 1) + bm.span * (KEY_PRIORITY[bk] || 1)
    }
    else if (a.tex !== b.tex){
      return a.tex < b.tex ? -1 : 1
    }
  })

  console.log(result.length)
  // console.log(result)

  return result
}

self.onmessage = event=> {
  const {data} = event
  if (data.msg === "search") {
    const result = Search(data.qstr, data.wholeWord)
    self.postMessage({result})
  }
  else if (data.assets) {
    self.assets = data.assets
  }
}

/* end of script */
}

let script = workerScript.toString()
script = script.substring(script.indexOf("{") + 1, script.lastIndexOf("}"))
let blob = new Blob([script], {type: "application/javascript"})
let worker = new Worker(URL.createObjectURL(blob))

export default worker