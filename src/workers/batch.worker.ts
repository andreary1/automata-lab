/// <reference lib="webworker" />
import type { BatchCase } from '../core/fa/batch';
import type { Machine } from '../core/machine';
import { runMachineBatch } from '../core/machineBatch';
import type { ProjectSettings } from '../core/persistence/schema';

export interface BatchRequest {
  machine: Machine;
  cases: BatchCase[];
  settings: ProjectSettings;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<BatchRequest>) => {
  const { machine, cases, settings } = ev.data;
  let last = 0;
  const results = runMachineBatch(machine, cases, settings, (done, total) => {
    const now = Date.now();
    if (now - last > 100 || done === total) {
      last = now;
      ctx.postMessage({ type: 'progress', done, total });
    }
  });
  ctx.postMessage({ type: 'done', results });
};
