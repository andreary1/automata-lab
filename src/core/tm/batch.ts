import type { BatchCase, BatchResult } from '../fa/batch';
import { formatWord, tokenize } from '../fa/symbols';
import type { TM } from './model';
import { DEFAULT_TM_LIMITS, runTM, type TMLimits } from './simulate';
import { validateTM } from './validate';

/**
 * Teste em lote para MT. "Esperado" refere-se à linguagem reconhecida L(M) = cadeias aceitas:
 * uma execução em laço provado conta como "não aceita" (confere com esperado = rejeitada).
 * Uma execução inconclusiva (limite) não confere nem diverge.
 */
export function runBatchTM(m: TM, cases: BatchCase[], opts: Partial<TMLimits> & { onProgress?: (d: number, t: number) => void } = {}): BatchResult[] {
  const report = validateTM(m);
  if (!report.valid) {
    const e = report.issues.find((i) => i.severity === 'error')!;
    return cases.map((c) => ({ input: c.input, display: c.input || 'ε', status: 'invalid', steps: 0, message: `Máquina inválida: ${e.message}`, expected: c.expected }));
  }
  const L: TMLimits = { ...DEFAULT_TM_LIMITS, ...opts };
  const out: BatchResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const tk = tokenize(c.input, m.inputAlphabet);
    if (!tk.ok) out.push({ input: c.input, display: c.input, status: 'invalid', steps: 0, message: tk.error, expected: c.expected });
    else {
      const t = runTM(m, tk.tokens, L, false);
      const r: BatchResult = { input: c.input, display: formatWord(tk.tokens, m.inputAlphabet), status: t.status, steps: t.stepCount, message: t.reason, expected: c.expected };
      if (c.expected && (t.status === 'accepted' || t.status === 'rejected' || t.status === 'loop')) r.matches = (t.status === 'accepted') === (c.expected === 'accepted');
      out.push(r);
    }
    opts.onProgress?.(i + 1, cases.length);
  }
  return out;
}
