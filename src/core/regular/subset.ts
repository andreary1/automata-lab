import { addCState, addCTrans, newCNFA, type CNFA } from './compact';
import { checkCancel, checkStates, DEFAULT_BUDGET, type Budget } from './budget';

/** Fecho-ε E(R) sobre a forma compacta (Sipser, prova do Teorema 1.39). */
export function closure(c: CNFA, from: Iterable<number>): number[] {
  const seen = new Set<number>(from);
  const stack = [...seen];
  while (stack.length) {
    const q = stack.pop()!;
    for (const t of c.eps[q]) if (!seen.has(t)) seen.add(t), stack.push(t);
  }
  return [...seen].sort((a, b) => a - b);
}

export function move(c: CNFA, set: number[], a: string): number[] {
  const out = new Set<number>();
  for (const q of set) for (const t of c.trans[q].get(a) ?? []) out.add(t);
  return [...out];
}

export function formatSubset(c: CNFA, set: number[]): string {
  return set.length === 0 ? '∅' : `{${set.map((i) => c.names[i]).join(', ')}}`;
}

export interface SubsetRow {
  /** Índice do estado do AFD */
  state: number;
  subset: number[];
  accepting: boolean;
  /** Para cada símbolo de Σ (na ordem): destino no AFD */
  targets: number[];
}

export interface SubsetResult {
  dfa: CNFA;
  /** subsets[i] = estados do AFN (índices) que compõem o estado i do AFD */
  subsets: number[][];
  rows: SubsetRow[];
  /** Total de subconjuntos possíveis (2^k), para comparação didática. */
  possible: number;
}

/**
 * Construção dos subconjuntos (Sipser, Teorema 1.39 e Exemplo 1.41), gerando
 * apenas os subconjuntos ALCANÇÁVEIS a partir de q0' = E({q0}) — o que o livro faz
 * ao remover estados sem setas de entrada (Figura 1.44). A linguagem é a mesma
 * da construção completa com 2^k estados.
 *   δ'(R, a) = { q | q ∈ E(δ(r, a)) para algum r ∈ R }
 *   F' = { R | R contém um estado de aceitação de N }
 * O resultado é um AFD completo sobre Σ (o subconjunto ∅ aparece quando alcançado).
 */
export function subsetConstruction(n: CNFA, budget: Budget = DEFAULT_BUDGET): SubsetResult {
  const dfa = newCNFA(n.alphabet);
  const key = (s: number[]) => s.join(',');
  const index = new Map<string, number>();
  const subsets: number[][] = [];
  const rows: SubsetRow[] = [];
  const get = (s: number[]) => {
    const k = key(s);
    let i = index.get(k);
    if (i === undefined) {
      i = addCState(dfa, formatSubset(n, s), s.some((q) => n.accept[q]));
      index.set(k, i);
      subsets.push(s);
      checkStates(budget, subsets.length, 'A construção dos subconjuntos');
    }
    return i;
  };
  dfa.start = get(closure(n, [n.start]));
  for (let i = 0; i < subsets.length; i++) {
    checkCancel(budget);
    const s = subsets[i];
    const targets: number[] = [];
    for (const a of n.alphabet) {
      const t = get(closure(n, move(n, s, a)));
      addCTrans(dfa, i, a, t);
      targets.push(t);
    }
    rows.push({ state: i, subset: s, accepting: dfa.accept[i], targets });
  }
  return { dfa, subsets, rows, possible: 2 ** n.names.length };
}

/**
 * Completa uma máquina determinística sobre `alphabet` com um estado poço quando
 * houver transições ausentes (inclusive em símbolos novos de Σ). Não altera a linguagem.
 */
export function completeDeterministic(c: CNFA, alphabet: string[], sinkName = '∅'): { dfa: CNFA; addedSink: boolean } {
  const out: CNFA = {
    alphabet: [...alphabet],
    names: [...c.names],
    start: c.start,
    accept: [...c.accept],
    trans: c.trans.map((r) => new Map([...r].filter(([a]) => alphabet.includes(a)).map(([a, l]) => [a, [...l]]))),
    eps: c.eps.map(() => []),
  };
  let sink = -1;
  const n = out.names.length;
  for (let q = 0; q < n; q++)
    for (const a of alphabet)
      if (!(out.trans[q].get(a)?.length)) {
        if (sink < 0) {
          let name = sinkName;
          while (out.names.includes(name)) name += '′';
          sink = addCState(out, name, false);
        }
        addCTrans(out, q, a, sink);
      }
  if (sink >= 0) for (const a of alphabet) addCTrans(out, sink, a, sink);
  return { dfa: out, addedSink: sink >= 0 };
}

/** Converte qualquer AF em AFD completo sobre `alphabet` (determiniza se preciso). */
export function toCompleteDFA(c: CNFA, alphabet: string[], budget: Budget = DEFAULT_BUDGET): { dfa: CNFA; determinized: boolean; addedSink: boolean; subsets?: number[][] } {
  const widened: CNFA = { ...c, alphabet: [...alphabet] };
  const deterministic = c.eps.every((e) => e.length === 0) && c.trans.every((r) => [...r.values()].every((l) => l.length <= 1));
  if (deterministic) {
    const r = completeDeterministic(widened, alphabet);
    return { dfa: r.dfa, determinized: false, addedSink: r.addedSink };
  }
  const s = subsetConstruction(widened, budget);
  return { dfa: s.dfa, determinized: true, addedSink: false, subsets: s.subsets };
}
