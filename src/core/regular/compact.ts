import { buildDelta, EPS } from '../fa/delta';
import { autoLayout } from '../fa/layout';
import type { FAEdge, FAKind, FiniteAutomaton } from '../fa/model';

/**
 * Representação compacta (índices numéricos) usada pelos algoritmos da Etapa 2.
 * Estado i ∈ [0, n); δ como lista por estado. ε fica em `eps`.
 */
export interface CNFA {
  alphabet: string[];
  names: string[];
  start: number;
  accept: boolean[];
  /** trans[i].get(a) = destinos a partir de i lendo a */
  trans: Map<string, number[]>[];
  eps: number[][];
}

export function cnfaSize(c: CNFA): number {
  return c.names.length;
}

export function newCNFA(alphabet: string[]): CNFA {
  return { alphabet: [...alphabet], names: [], start: 0, accept: [], trans: [], eps: [] };
}

export function addCState(c: CNFA, name: string, accept = false): number {
  c.names.push(name);
  c.accept.push(accept);
  c.trans.push(new Map());
  c.eps.push([]);
  return c.names.length - 1;
}

export function addCTrans(c: CNFA, from: number, sym: string | null, to: number) {
  if (sym === null) {
    if (!c.eps[from].includes(to)) c.eps[from].push(to);
    return;
  }
  const row = c.trans[from];
  const list = row.get(sym) ?? [];
  if (!list.includes(to)) list.push(to);
  row.set(sym, list);
}

/** Converte uma máquina do editor (já validada) para a forma compacta. Estados preservam a ordem. */
export function toCNFA(m: FiniteAutomaton): CNFA {
  const c = newCNFA(m.alphabet);
  const index = new Map<string, number>();
  m.states.forEach((s) => index.set(s.id, addCState(c, s.name, s.accepting)));
  c.start = m.initial ? index.get(m.initial)! : 0;
  const delta = buildDelta(m);
  for (const s of m.states) {
    const row = delta.get(s.id)!;
    for (const [sym, entry] of row) for (const t of entry.targets) addCTrans(c, index.get(s.id)!, sym === EPS ? null : sym, index.get(t)!);
  }
  return c;
}

export function isDeterministic(c: CNFA): boolean {
  return c.eps.every((e) => e.length === 0) && c.trans.every((row) => [...row.values()].every((l) => l.length <= 1));
}

/** Converte de volta para o modelo do editor, com ids estáveis novos, arestas agrupadas e layout automático. */
export function fromCNFA(c: CNFA, kind: FAKind, idPrefix = 's'): FiniteAutomaton {
  const states = c.names.map((name, i) => ({ id: `${idPrefix}${i}`, name, x: 0, y: 0, accepting: c.accept[i] }));
  const edges = new Map<string, FAEdge>();
  const edge = (from: number, to: number) => {
    const key = `${from}>${to}`;
    let e = edges.get(key);
    if (!e) {
      e = { id: `e${edges.size}`, from: `${idPrefix}${from}`, to: `${idPrefix}${to}`, symbols: [], epsilon: false };
      edges.set(key, e);
    }
    return e;
  };
  c.trans.forEach((row, i) => {
    // ordem dos símbolos segue Σ
    for (const a of c.alphabet) for (const t of row.get(a) ?? []) edge(i, t).symbols.push(a);
  });
  c.eps.forEach((list, i) => list.forEach((t) => (edge(i, t).epsilon = true)));
  const m: FiniteAutomaton = { kind, alphabet: [...c.alphabet], states, edges: [...edges.values()], initial: states.length ? `${idPrefix}${c.start}` : null };
  const pos = autoLayout(m);
  return { ...m, states: m.states.map((s) => ({ ...s, ...(pos.get(s.id) ?? { x: 0, y: 0 }) })) };
}

/** Une dois alfabetos preservando a ordem (primeiro os de A). */
export function unionAlphabet(a: string[], b: string[]): string[] {
  return [...a, ...b.filter((x) => !a.includes(x))];
}

/** Garante nomes únicos acrescentando sufixos ′. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((n) => {
    let x = n;
    while (seen.has(x)) x += '′';
    seen.add(x);
    return x;
  });
}
