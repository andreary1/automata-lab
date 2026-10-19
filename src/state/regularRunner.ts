import { toOpError, type OpError } from '../core/regular/api';
import { executeRegular, type RegularRequest } from '../core/regular/requests';
import RegularWorker from '../workers/regular.worker?worker&inline';

export type RunOutcome<T> = { ok: true; result: T } | { ok: false; error: OpError };

/**
 * Executa um algoritmo da Etapa 2 em Web Worker. `cancel()` encerra o worker
 * imediatamente. Sem suporte a workers, roda na thread principal (sem cancelamento).
 */
export function runRegular<T>(req: RegularRequest): { promise: Promise<RunOutcome<T>>; cancel: () => void } {
  let worker: Worker | null = null;
  try {
    worker = new RegularWorker();
  } catch {
    worker = null;
  }
  if (!worker) {
    const promise = new Promise<RunOutcome<T>>((resolve) =>
      setTimeout(() => {
        try {
          resolve({ ok: true, result: executeRegular(req) as T });
        } catch (e) {
          resolve({ ok: false, error: toOpError(e) });
        }
      }, 0),
    );
    return { promise, cancel: () => {} };
  }
  const w = worker;
  let settle: (r: RunOutcome<T>) => void = () => {};
  const promise = new Promise<RunOutcome<T>>((resolve) => (settle = resolve));
  w.onmessage = (ev) => {
    w.terminate();
    settle(ev.data);
  };
  w.onerror = (ev) => {
    w.terminate();
    ev.preventDefault?.();
    // Worker bloqueado (ex.: política do ambiente): executa na thread principal.
    try {
      settle({ ok: true, result: executeRegular(req) as T });
    } catch (e) {
      settle({ ok: false, error: toOpError(e) });
    }
  };
  w.postMessage(req);
  return {
    promise,
    cancel: () => {
      w.terminate();
      settle({ ok: false, error: { kind: 'cancelled', message: 'Operação cancelada pelo usuário. Nenhum resultado foi produzido.' } });
    },
  };
}
