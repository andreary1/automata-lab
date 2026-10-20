import type { TM } from '../core/tm/model';
import { simulateTM, type TMLimits, type TMTrace } from '../core/tm/simulate';
import TMWorker from '../workers/tm.worker?worker&inline';

/**
 * Executa uma MT num Web Worker (até o limite de passos, que pode ser alto).
 * `cancel()` encerra o worker; a promessa resolve com 'cancelled'.
 * Sem suporte a workers, roda na thread principal.
 */
export function runTMSimulation(m: TM, input: string, limits: Partial<TMLimits>): { promise: Promise<TMTrace | 'cancelled'>; cancel: () => void } {
  let settle: (v: TMTrace | 'cancelled') => void = () => {};
  const promise = new Promise<TMTrace | 'cancelled'>((r) => (settle = r));
  const fallback = () => setTimeout(() => settle(simulateTM(m, input, limits, true)), 0);
  let w: Worker | null = null;
  try {
    w = new TMWorker();
  } catch {
    w = null;
  }
  if (!w) {
    fallback();
    return { promise, cancel: () => settle('cancelled') };
  }
  const worker = w;
  worker.onmessage = (ev) => {
    worker.terminate();
    settle(ev.data);
  };
  worker.onerror = (ev) => {
    ev.preventDefault?.();
    worker.terminate();
    fallback();
  };
  worker.postMessage({ machine: m, input, limits });
  return {
    promise,
    cancel: () => {
      worker.terminate();
      settle('cancelled');
    },
  };
}
