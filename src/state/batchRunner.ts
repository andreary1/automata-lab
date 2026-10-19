import type { BatchResult } from '../core/fa/batch';
import { runMachineBatch } from '../core/machineBatch';
import { useApp } from './store';
import BatchWorker from '../workers/batch.worker?worker&inline';

/**
 * Executa o lote em um Web Worker (cancelável com terminate()). Se o navegador
 * não permitir workers, executa na thread principal em fatias, também cancelável.
 */
let current: { cancel: () => void } | null = null;

export function startBatch() {
  const st = useApp.getState();
  if (st.batch.running) return;
  const cases = st.project.tests;
  if (cases.length === 0) {
    st.showToast('Adicione ao menos uma cadeia ao lote.', 'error');
    return;
  }
  const machine = st.project.machine;
  const settings = st.project.settings;
  st.setBatch({ running: true, progress: [0, cases.length], results: null, stale: false });

  const finish = (results: BatchResult[]) => {
    current = null;
    useApp.getState().setBatch({ running: false, results, progress: [results.length, cases.length] });
  };
  const interrupted = (done: BatchResult[]) =>
    finish([
      ...done,
      ...cases.slice(done.length).map((c) => ({
        input: c.input,
        display: c.input.trim() === '' ? 'ε' : c.input,
        status: 'interrupted' as const,
        steps: 0,
        message: 'Lote cancelado pelo usuário.',
        expected: c.expected,
      })),
    ]);

  let worker: Worker | null = null;
  try {
    worker = new BatchWorker();
  } catch {
    worker = null;
  }

  if (worker) {
    const w = worker;
    w.onmessage = (ev) => {
      if (ev.data.type === 'progress') useApp.getState().setBatch({ progress: [ev.data.done, ev.data.total] });
      else if (ev.data.type === 'done') {
        w.terminate();
        finish(ev.data.results);
      }
    };
    w.onerror = () => {
      w.terminate();
      runOnMainThread();
    };
    current = {
      cancel: () => {
        w.terminate();
        interrupted([]);
      },
    };
    w.postMessage({ machine, cases, settings });
    return;
  }
  runOnMainThread();

  function runOnMainThread() {
    let cancelled = false;
    const done: BatchResult[] = [];
    current = { cancel: () => (cancelled = true) };
    let i = 0;
    const chunk = () => {
      if (cancelled) return interrupted(done);
      const end = Math.min(cases.length, i + 50);
      done.push(...runMachineBatch(machine, cases.slice(i, end), settings));
      i = end;
      useApp.getState().setBatch({ progress: [i, cases.length] });
      if (i < cases.length) setTimeout(chunk, 0);
      else finish(done);
    };
    setTimeout(chunk, 0);
  }
}

export function cancelBatch() {
  current?.cancel();
}
