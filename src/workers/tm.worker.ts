/// <reference lib="webworker" />
import type { TM } from '../core/tm/model';
import { simulateTM, type TMLimits } from '../core/tm/simulate';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<{ machine: TM; input: string; limits: Partial<TMLimits> }>) => {
  const { machine, input, limits } = ev.data;
  ctx.postMessage(simulateTM(machine, input, limits, true));
};
