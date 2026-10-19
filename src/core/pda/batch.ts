import type { BatchCase, BatchResult } from '../fa/batch';
import { formatWord, tokenize } from '../fa/symbols';
import type { PDA } from './model';
import { DEFAULT_PDA_LIMITS, runPDA, type PDALimits } from './simulate';
import { validatePDA } from './validate';

/**
 * Teste em lote para AP. "Passos" = profundidade da busca em largura quando a cadeia é
 * aceita (comprimento do caminho de aceitação) ou quantidade de configurações exploradas
 * nos demais casos (informado na mensagem).
 */
export function runBatchPDA(m: PDA, cases: BatchCase[], opts: Partial<PDALimits> & { shouldCancelBatch?: () => boolean; onProgress?: (d: number, t: number) => void } = {}): BatchResult[] {
  const report = validatePDA(m);
  if (!report.valid) {
    const e = report.issues.find((i) => i.severity === 'error')!;
    return cases.map((c) => ({ input: c.input, display: c.input || 'ε', status: 'invalid', steps: 0, message: `Máquina inválida: ${e.message}`, expected: c.expected }));
  }
  const L: PDALimits = { ...DEFAULT_PDA_LIMITS, ...opts };
  const out: BatchResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (opts.shouldCancelBatch?.()) {
      for (let j = i; j < cases.length; j++) out.push({ input: cases[j].input, display: cases[j].input || 'ε', status: 'interrupted', steps: 0, message: 'Lote cancelado antes desta cadeia.', expected: cases[j].expected });
      break;
    }
    const tk = tokenize(c.input, m.inputAlphabet);
    if (!tk.ok) out.push({ input: c.input, display: c.input, status: 'invalid', steps: 0, message: tk.error, expected: c.expected });
    else {
      const t = runPDA(m, tk.tokens, L, false);
      const steps = t.depth;
      const r: BatchResult = {
        input: c.input,
        display: formatWord(tk.tokens, m.inputAlphabet),
        status: t.status,
        steps,
        message: `${t.reason} (${t.explored} configurações exploradas)`,
        expected: c.expected,
      };
      if (c.expected && (t.status === 'accepted' || t.status === 'rejected')) r.matches = t.status === c.expected;
      out.push(r);
    }
    opts.onProgress?.(i + 1, cases.length);
  }
  return out;
}
