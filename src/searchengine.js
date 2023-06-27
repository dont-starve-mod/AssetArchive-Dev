/**
 * search the best sub sequence, return match position if success
 * @param {string} str  the long string
 * @param {string} needle the short string (query)
 * @param {boolean} wholeWord sub sequence -> sub string, if set to true
 * @returns {Array}
 */
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

function Search(str, wholeWord, interrupt = []) {
  const result = []

  // asset search
  const FIELDS = ["file", "xml", "tex", "texname", "desc"]
  Object.keys(window.assets).forEach(k=> {
    if (interrupt[0]) return
    window.assets[k].forEach(asset=> {
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

  console.log(result.length)
  return result
}

function workerScript() {
  self.onmessage = event=> {
    console.log("WORKER", event.data)
    const {data} = event
    self.postMessage("收到了")
    if (data.msg === "search") {
      Search(data.qstr)
    }
  }
}

let script = workerScript.toString()
script = script.substring(script.indexOf("{") + 1, script.lastIndexOf("}"))
let blob = new Blob([script], {type: "application/javascript"})
Search.worker = new Worker(URL.createObjectURL(blob))

export default Search