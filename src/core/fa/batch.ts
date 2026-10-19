import { buildDelta } from './delta';
import type { FiniteAutomaton } from './model';
import { runTokens, type RunStatus, DEFAULT_MAX_STEPS } from './simulate';
import { formatWord, tokenize } from './symbols';
import { validate } from './validate';

export interface BatchCase {
  input: string;
  /** Resultado esperado (opcional), para conferência. */
  expected?: 'accepted' | 'rejected';
}

export interface BatchResult {
  input: string;
  display: string;
  status: RunStatus;
  steps: number;
  message: string;
  expected?: 'accepted' | 'rejected';
  /** true/false se havia expectativa; undefined caso contrário. */
  matches?: boolean;
}

export interface BatchOptions {
  maxSteps?: number;
  /** Consultado entre cadeias; se true, as restantes ficam "interrompidas". */
  shouldCancel?: () => boolean;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Teste em lote. Não guarda os traços (economia de memória). Contagem de passos =
 * símbolos processados (para AFN, cada passo processa o conjunto de estados ativos).
 */
export function runBatch(m: FiniteAutomaton, cases: BatchCase[], opts: BatchOptions = {}): BatchResult[] {
  const report = validate(m);
  const out: BatchResult[] = [];
  if (!report.valid) {
    const first = report.issues.find((i) => i.severity === 'error')!;
    return cases.map((c) => ({ input: c.input, display: c.input || 'ε', status: 'invalid', steps: 0, message: `Máquina inválida: ${first.message}`, expected: c.expected }));
  }
  const delta = buildDelta(m);
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (opts.shouldCancel?.()) {
      for (let j = i; j < cases.length; j++) {
        out.push({ input: cases[j].input, display: cases[j].input || 'ε', status: 'interrupted', steps: 0, message: 'Lote cancelado antes desta cadeia.', expected: cases[j].expected });
      }
      break;
    }
    const tk = tokenize(c.input, m.alphabet);
    if (!tk.ok) {
      out.push({ input: c.input, display: c.input, status: 'invalid', steps: 0, message: tk.error, expected: c.expected });
    } else {
      const t = runTokens(m, delta, tk.tokens, { recordTrace: false, maxSteps });
      const steps = t.processed;
      const r: BatchResult = { input: c.input, display: formatWord(tk.tokens, m.alphabet), status: t.status, steps, message: t.reason, expected: c.expected };
      if (c.expected && (t.status === 'accepted' || t.status === 'rejected')) r.matches = t.status === c.expected;
      out.push(r);
    }
    opts.onProgress?.(i + 1, cases.length);
  }
  return out;
}

