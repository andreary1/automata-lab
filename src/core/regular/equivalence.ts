import { unionAlphabet, type CNFA } from './compact';
import { checkCancel, DEFAULT_BUDGET, LimitError, type Budget } from './budget';
import { toCompleteDFA } from './subset';

export type EquivalenceResult =
  | { equivalent: true; alphabet: string[]; explored: number; sizes: [number, number]; notes: string[] }
  | {
      equivalent: false;
      alphabet: string[];
      /** Menor contraexemplo (em número de símbolos), como lista de símbolos. */
      counterexample: string[];
      acceptedBy: 'A' | 'B';
      explored: number;
      sizes: [number, number];
      notes: string[];
    };

/**
 * Equivalência EXATA de autômatos finitos (Sipser, Teorema 4.5): L(A) = L(B) sse a
 * diferença simétrica (L(A) ∩ L(B)̄) ∪ (L(A)̄ ∩ L(B)) é vazia. Implementação: determiniza e
 * completa A e B sobre Σ = Σ_A ∪ Σ_B e percorre em LARGURA os pares alcançáveis do produto.
 * Um par em que exatamente um aceita testemunha uma cadeia da diferença simétrica — a BFS
 * garante que é um contraexemplo de comprimento mínimo. Se nenhum par alcançável é assim, a
 * diferença simétrica é vazia (é o teste de vacuidade do Teorema 4.4) e as linguagens são iguais.
 * Isto é uma prova, não uma amostragem: o número de pares é finito e todos são examinados.
 */
export function checkEquivalence(A: CNFA, B: CNFA, budget: Budget = DEFAULT_BUDGET): EquivalenceResult {
  const Σ = unionAlphabet(A.alphabet, B.alphabet);
  const da = toCompleteDFA(A, Σ, budget);
  const db = toCompleteDFA(B, Σ, budget);
  const a = da.dfa;
  const b = db.dfa;
  const notes: string[] = [];
  if (Σ.length !== A.alphabet.length || Σ.length !== B.alphabet.length) notes.push(`Os alfabetos diferem; a comparação usa Σ = {${Σ.join(', ')}}.`);
  if (da.determinized) notes.push(`A foi determinizada (${a.names.length} estados alcançáveis).`);
  if (db.determinized) notes.push(`B foi determinizada (${b.names.length} estados alcançáveis).`);
  const maxPairs = budget.maxStates * 20;
  const key = (p: number, q: number) => p * b.names.length + q;
  const parent = new Map<number, { prev: number; sym: string } | null>();
  const start = key(a.start, b.start);
  parent.set(start, null);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    checkCancel(budget);
    const k = queue[i];
    const p = Math.floor(k / b.names.length);
    const q = k % b.names.length;
    if (a.accept[p] !== b.accept[q]) {
      const word: string[] = [];
      for (let cur = k; parent.get(cur); cur = parent.get(cur)!.prev) word.unshift(parent.get(cur)!.sym);
      return { equivalent: false, alphabet: Σ, counterexample: word, acceptedBy: a.accept[p] ? 'A' : 'B', explored: i + 1, sizes: [a.names.length, b.names.length], notes };
    }
    for (const s of Σ) {
      const nk = key(a.trans[p].get(s)![0], b.trans[q].get(s)![0]);
      if (!parent.has(nk)) {
        parent.set(nk, { prev: k, sym: s });
        queue.push(nk);
        if (queue.length > maxPairs) throw new LimitError(`A verificação passou de ${maxPairs} pares de estados. Aumente o limite para concluir; nenhuma conclusão foi tirada.`);
      }
    }
  }
  notes.push(`Todos os ${queue.length} pares alcançáveis do produto foram examinados e, em nenhum, exatamente um dos autômatos aceita: a diferença simétrica é vazia.`);
  return { equivalent: true, alphabet: Σ, explored: queue.length, sizes: [a.names.length, b.names.length], notes };
}
