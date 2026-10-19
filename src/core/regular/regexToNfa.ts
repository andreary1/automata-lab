import { addCState, addCTrans, newCNFA, type CNFA } from './compact';
import type { Re } from './regex';
import { checkStates, DEFAULT_BUDGET, type Budget } from './budget';

/**
 * ER → AFN seguindo a prova do Lema 1.55 (Sipser, p. 68–69):
 *  1. R = a: dois estados, q1 --a--> q2, F = {q2};
 *  2. R = ε: um estado inicial que é de aceitação;
 *  3. R = ∅: um estado sem aceitação;
 *  4–6. ∪, ∘ e * pelas construções dos Teoremas 1.45, 1.47 e 1.49:
 *     ∪: novo estado inicial com ε para os iniciais de N1 e N2; F = F1 ∪ F2;
 *     ∘: ε de cada estado de F1 para o inicial de N2; F = F2;
 *     *: novo inicial de aceitação com ε para o inicial antigo; ε de F1 para o inicial antigo.
 * Os estados são renomeados q0, q1, … em ordem de busca em largura a partir do inicial.
 */
export function regexToNfa(re: Re, alphabet: string[], budget: Budget = DEFAULT_BUDGET): CNFA {
  const c = newCNFA(alphabet);
  const st = () => {
    const i = addCState(c, '');
    checkStates(budget, c.names.length, 'A conversão ER → AFN');
    return i;
  };
  type Frag = { start: number; accepts: number[] };
  const build = (r: Re): Frag => {
    switch (r.t) {
      case 'sym': {
        const s = st();
        const f = st();
        addCTrans(c, s, r.a, f);
        return { start: s, accepts: [f] };
      }
      case 'eps': {
        const s = st();
        return { start: s, accepts: [s] };
      }
      case 'empty':
        return { start: st(), accepts: [] };
      case 'union': {
        const q0 = st();
        const a = build(r.l);
        const b = build(r.r);
        addCTrans(c, q0, null, a.start);
        addCTrans(c, q0, null, b.start);
        return { start: q0, accepts: [...a.accepts, ...b.accepts] };
      }
      case 'concat': {
        const a = build(r.l);
        const b = build(r.r);
        for (const f of a.accepts) addCTrans(c, f, null, b.start);
        return { start: a.start, accepts: b.accepts };
      }
      case 'star': {
        const q0 = st();
        const a = build(r.r);
        addCTrans(c, q0, null, a.start);
        for (const f of a.accepts) addCTrans(c, f, null, a.start);
        return { start: q0, accepts: [q0, ...a.accepts] };
      }
    }
  };
  const frag = build(re);
  frag.accepts.forEach((f) => (c.accept[f] = true));
  c.start = frag.start;
  return renumberBFS(c);
}

/** Renumera estados em ordem de BFS a partir do inicial (estados inalcançáveis vão ao fim). */
export function renumberBFS(c: CNFA, prefix = 'q'): CNFA {
  const n = c.names.length;
  const order: number[] = [c.start];
  const seen = new Set(order);
  for (let i = 0; i < order.length; i++) {
    const q = order[i];
    const nexts = [...c.eps[q], ...c.alphabet.flatMap((a) => c.trans[q].get(a) ?? [])];
    for (const t of nexts) if (!seen.has(t)) seen.add(t), order.push(t);
  }
  for (let q = 0; q < n; q++) if (!seen.has(q)) order.push(q);
  const pos = new Map(order.map((q, i) => [q, i]));
  const out = newCNFA(c.alphabet);
  order.forEach((q, i) => addCState(out, `${prefix}${i}`, c.accept[q]));
  out.start = 0;
  for (const q of order) {
    for (const [a, ts] of c.trans[q]) for (const t of ts) addCTrans(out, pos.get(q)!, a, pos.get(t)!);
    for (const t of c.eps[q]) addCTrans(out, pos.get(q)!, null, pos.get(t)!);
  }
  return out;
}
