/// <reference lib="webworker" />
import type { PDA } from '../core/pda/model';
import { simulatePDA, type PDALimits } from '../core/pda/simulate';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<{ machine: PDA; input: string; limits: Partial<PDALimits> }>) => {
  const { machine, input, limits } = ev.data;
  ctx.postMessage(simulatePDA(machine, input, limits, true));
};
