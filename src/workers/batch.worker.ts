/// <reference lib="webworker" />
import { runBatch, type BatchCase } from '../core/fa/batch';
import type { FiniteAutomaton } from '../core/fa/model';

export interface BatchRequest {
  machine: FiniteAutomaton;
  cases: BatchCase[];
  maxSteps: number;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<BatchRequest>) => {
  const { machine, cases, maxSteps } = ev.data;
  let last = 0;
  const results = runBatch(machine, cases, {
    maxSteps,
    onProgress: (done, total) => {
      const now = Date.now();
      if (now - last > 100 || done === total) {
        last = now;
        ctx.postMessage({ type: 'progress', done, total });
      }
    },
  });
  ctx.postMessage({ type: 'done', results });
};
