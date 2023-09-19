/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { blockingFunc } from "./test_utils";

export const someRPCFunc = () => {
  blockingFunc();
};

export const test = ()=> {
  return "114514"
}

