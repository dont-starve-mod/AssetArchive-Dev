console.log("Load", 'test_urils')
import * as Comlink from 'comlink'
export const blockingFunc = () => {
  new Array(100_000_000)
    .map((elm, index) => elm + index)
    .reduce((acc, cur) => acc + cur, 0);
};

export const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const workerInstance = new ComlinkWorker(
  new URL("./test_worker.ts", import.meta.url)
);
console.log('worker', workerInstance)