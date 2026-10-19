import type { PDA } from '../core/pda/model';
import { simulatePDA, type PDALimits, type PDATrace } from '../core/pda/simulate';
import PDAWorker from '../workers/pda.worker?worker&inline';

/**
 * Simula um AP num Web Worker (a busca em largura pode explorar muitas configurações).
 * `cancel()` encerra o worker; a promessa resolve com 'cancelled'.
 * Sem suporte a workers, roda na thread principal.
 */
export function runPDASimulation(m: PDA, input: string, limits: Partial<PDALimits>): { promise: Promise<PDATrace | 'cancelled'>; cancel: () => void } {
  let settle: (v: PDATrace | 'cancelled') => void = () => {};
  const promise = new Promise<PDATrace | 'cancelled'>((r) => (settle = r));
  const fallback = () => setTimeout(() => settle(simulatePDA(m, input, limits, true)), 0);
  let w: Worker | null = null;
  try {
    w = new PDAWorker();
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
