// let blob = new Blob([script], {type: "application/javascript"})
// let url = URL.createObjectURL(blob)

import Searcher from "./asyncsearcher"
export const PREDICT = new Searcher("renderer_predict_worker")


window.s = PREDICT
