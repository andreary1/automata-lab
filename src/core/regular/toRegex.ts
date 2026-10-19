import type { CNFA } from './compact';
import { checkCancel, DEFAULT_BUDGET, LimitError, type Budget } from './budget';
import { concat, EMPTY_RE, EPS_RE, rawConcat, rawStar, rawUnion, star, sym, union, type Re } from './regex';

export interface GnfaStep {
  removed: string;
  /** Rótulos alterados neste passo: origem → destino = nova expressão (no máximo 40). */
  changes: { from: string; to: string; label: string }[];
  changesOmitted: number;
  remaining: number;
}

export interface ToRegexResult {
  regex: Re;
  steps: GnfaStep[];
  order: string[];
  simplified: boolean;
}

/**
 * AF → ER pelo método do AFNG (Sipser, Lema 1.60, Definição 1.64 e procedimento CONVERT):
 *  - acrescenta q_início (com ε para o inicial antigo) e q_aceita (com ε a partir de cada
 *    estado de aceitação); várias setas entre o mesmo par viram a união dos rótulos;
 *    pares sem seta têm rótulo ∅;
 *  - remove um estado q_rem por vez, trocando cada rótulo q_i → q_j por
 *    (R1)(R2)*(R3) ∪ (R4), com R1 = δ(q_i,q_rem), R2 = δ(q_rem,q_rem), R3 = δ(q_rem,q_j), R4 = δ(q_i,q_j);
 *  - quando restam dois estados, o rótulo q_início → q_aceita é a resposta.
 * O livro enuncia o lema para AFD. Aplicá-lo a um AFN é uma extensão direta (todo AFN, com
 * os dois estados novos, é um AFNG no formato especial) — classificada como complementar.
 *
 * `simplify` aplica identidades que preservam a linguagem (R ∪ ∅ = R, Rε = R, R∅ = ∅,
 * ∅* = ε, …), como o próprio livro faz no Exemplo 1.66. Sem simplificar, a fórmula é usada
 * literalmente e o resultado fica bem maior.
 * `order`: 'heuristic' remove primeiro o estado com menos combinações entrada×saída;
 * 'listed' remove na ordem dos estados da máquina.
 */
export function faToRegex(c: CNFA, opts: { simplify?: boolean; order?: 'heuristic' | 'listed' } = {}, budget: Budget = DEFAULT_BUDGET): ToRegexResult {
  const simplify = opts.simplify !== false;
  const U = simplify ? union : rawUnion;
  const C = simplify ? concat : rawConcat;
  const S = simplify ? star : rawStar;
  const n = c.names.length;
  // índices: 0..n-1 originais, n = início, n+1 = aceita
  const START = n;
  const ACC = n + 1;
  const names = [...c.names, 'q_início', 'q_aceita'];
  const R = new Map<number, Map<number, Re>>();
  const get = (i: number, j: number): Re => R.get(i)?.get(j) ?? EMPTY_RE;
  const set = (i: number, j: number, r: Re) => {
    if (!R.has(i)) R.set(i, new Map());
    if (r.t === 'empty') R.get(i)!.delete(j);
    else R.get(i)!.set(j, r);
  };
  const addLabel = (i: number, j: number, r: Re) => set(i, j, get(i, j).t === 'empty' ? r : U(get(i, j), r));
  for (let q = 0; q < n; q++) {
    for (const a of c.alphabet) for (const t of c.trans[q].get(a) ?? []) addLabel(q, t, sym(a));
    for (const t of c.eps[q]) addLabel(q, t, EPS_RE);
  }
  set(START, c.start, EPS_RE);
  for (let q = 0; q < n; q++) if (c.accept[q]) addLabel(q, ACC, EPS_RE);

  const alive = new Set<number>([...Array(n).keys()]);
  const steps: GnfaStep[] = [];
  const order: string[] = [];
  const preds = (k: number) => [START, ...alive].filter((i) => i !== k && R.get(i)?.has(k));
  const succs = (k: number) => [...alive, ACC].filter((j) => j !== k && R.get(k)?.has(j));

  while (alive.size > 0) {
    checkCancel(budget);
    let rem: number;
    if (opts.order === 'listed') rem = Math.min(...alive);
    else {
      rem = -1;
      let best = Infinity;
      for (const k of alive) {
        const cost = preds(k).length * succs(k).length;
        if (cost < best) (best = cost), (rem = k);
      }
    }
    const R2 = get(rem, rem);
    const loop = R2.t === 'empty' ? null : S(R2);
    const changes: GnfaStep['changes'] = [];
    let omitted = 0;
    const P = preds(rem);
    const Sx = succs(rem);
    for (const i of P) {
      const R1 = get(i, rem);
      for (const j of Sx) {
        const R3 = get(rem, j);
        // (R1)(R2)*(R3) ∪ (R4); quando R2 = ∅, (R2)* = ε
        const via = loop ? C(C(R1, loop), R3) : C(R1, R3);
        const R4 = get(i, j);
        const next = simplify ? U(R4, via) : R4.t === 'empty' ? via : rawUnion(via, R4);
        set(i, j, next);
        if (changes.length < 40) changes.push({ from: names[i], to: names[j], label: next.str });
        else omitted++;
      }
    }
    // remove q_rem
    R.delete(rem);
    for (const m of R.values()) m.delete(rem);
    alive.delete(rem);
    order.push(names[rem]);
    steps.push({ removed: names[rem], changes, changesOmitted: omitted, remaining: alive.size + 2 });
    let total = 0;
    for (const m of R.values()) for (const r of m.values()) total += r.str.length;
    if (total > budget.maxRegexLength)
      throw new LimitError(`As expressões intermediárias passaram de ${budget.maxRegexLength} caracteres. A conversão AFNG pode crescer exponencialmente; tente minimizar a máquina antes ou aumentar o limite.`);
  }
  return { regex: get(START, ACC), steps, order, simplified: simplify };
}
