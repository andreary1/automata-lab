import { addCState, addCTrans, newCNFA, type CNFA } from './compact';
import { checkCancel, DEFAULT_BUDGET, type Budget } from './budget';

export interface MinimizeResult {
  dfa: CNFA;
  /** blocks[i] = estados (índices no AFD de entrada) agrupados no estado i do AFD mínimo */
  blocks: number[][];
  /** Nomes dos estados inalcançáveis removidos antes do refinamento. */
  removedUnreachable: string[];
  /** Partição em cada rodada (rodada 0 = {F, Q−F}), como listas de nomes. */
  rounds: string[][][];
}

/**
 * Minimização de AFD completo — ALGORITMO COMPLEMENTAR (não está no texto do Sipser
 * consultado). Duas fases:
 *  1. remove estados inalcançáveis a partir do inicial (não afetam a linguagem);
 *  2. refinamento de partição de Moore: começa com {F, Q − F}; em cada rodada separa
 *     estados que, para algum símbolo, vão para blocos diferentes; para quando nada muda.
 * Estados no mesmo bloco final são indistinguíveis (nenhuma cadeia os separa), e o AFD
 * quociente resultante é o AFD completo com o menor número de estados para a linguagem
 * (único a menos de renomeação — teorema de Myhill–Nerode).
 * Pré-condição: `dfa` determinístico e completo sobre seu Σ.
 */
export function minimizeDFA(dfa: CNFA, budget: Budget = DEFAULT_BUDGET): MinimizeResult {
  const Σ = dfa.alphabet;
  const δ = (q: number, a: string) => {
    const l = dfa.trans[q].get(a);
    if (!l || l.length !== 1) throw new Error('minimizeDFA exige AFD completo.');
    return l[0];
  };
  // 1. alcançáveis
  const reach = new Set([dfa.start]);
  const order = [dfa.start];
  for (let i = 0; i < order.length; i++) for (const a of Σ) {
    const t = δ(order[i], a);
    if (!reach.has(t)) reach.add(t), order.push(t);
  }
  const states = [...reach].sort((a, b) => a - b);
  const removedUnreachable = dfa.names.filter((_, i) => !reach.has(i));

  // 2. refinamento
  let block = new Map<number, number>();
  const F = states.filter((q) => dfa.accept[q]);
  const NF = states.filter((q) => !dfa.accept[q]);
  const initial = [F, NF].filter((b) => b.length > 0);
  initial.forEach((b, i) => b.forEach((q) => block.set(q, i)));
  const names = (bs: number[][]) => bs.map((b) => b.map((q) => dfa.names[q]));
  const rounds: string[][][] = [names(initial)];
  let count = initial.length;
  for (;;) {
    checkCancel(budget);
    const sig = new Map<string, number>();
    const next = new Map<number, number>();
    const groups: number[][] = [];
    for (const q of states) {
      const s = `${block.get(q)}|${Σ.map((a) => block.get(δ(q, a))).join(',')}`;
      let b = sig.get(s);
      if (b === undefined) {
        b = groups.length;
        sig.set(s, b);
        groups.push([]);
      }
      groups[b].push(q);
      next.set(q, b);
    }
    block = next;
    if (groups.length === count) break;
    count = groups.length;
    rounds.push(names(groups));
  }
  // 3. AFD quociente, numerando blocos a partir do bloco inicial em BFS (estável)
  const blockOf = (q: number) => block.get(q)!;
  const members = new Map<number, number[]>();
  for (const q of states) members.set(blockOf(q), [...(members.get(blockOf(q)) ?? []), q]);
  const out = newCNFA(Σ);
  const newIndex = new Map<number, number>();
  const blocks: number[][] = [];
  const queue = [blockOf(dfa.start)];
  const label = (ms: number[]) => (ms.length === 1 ? dfa.names[ms[0]] : `{${ms.map((q) => dfa.names[q]).join(', ')}}`);
  const ensure = (b: number) => {
    if (!newIndex.has(b)) {
      const ms = members.get(b)!;
      newIndex.set(b, addCState(out, label(ms), dfa.accept[ms[0]]));
      blocks.push(ms);
      queue.push(b);
    }
    return newIndex.get(b)!;
  };
  queue.length = 0;
  out.start = ensure(blockOf(dfa.start));
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i];
    const rep = members.get(b)![0];
    for (const a of Σ) addCTrans(out, newIndex.get(b)!, a, ensure(blockOf(δ(rep, a))));
  }
  return { dfa: out, blocks, removedUnreachable, rounds };
}
