import type { FiniteAutomaton } from './model';

/**
 * δ derivada das arestas.
 *  - AFN (Def. 1.37): δ: Q × Σε → P(Q). Representamos por Map<estado, Map<símbolo|ε, Set<estado>>>.
 *  - AFD (Def. 1.5):  δ: Q × Σ → Q. Um AFD válido é o caso em que cada conjunto tem exatamente 1 elemento
 *    e não há ε. A validação aponta quando isso não ocorre.
 *
 * A chave EPS (string vazia) representa ε internamente — é exatamente a palavra vazia, e nunca é um
 * símbolo válido de Σ (ver symbols.ts), então não há colisão.
 */
export const EPS = '';

export interface DeltaEntry {
  targets: Set<string>;
  /** Ids das arestas que produzem cada destino (para destacar no diagrama). */
  edgeByTarget: Map<string, string>;
}

export type Delta = Map<string, Map<string, DeltaEntry>>;

export function buildDelta(m: FiniteAutomaton): Delta {
  const delta: Delta = new Map();
  for (const s of m.states) delta.set(s.id, new Map());
  const add = (from: string, sym: string, to: string, edgeId: string) => {
    const row = delta.get(from);
    if (!row) return;
    let e = row.get(sym);
    if (!e) {
      e = { targets: new Set(), edgeByTarget: new Map() };
      row.set(sym, e);
    }
    e.targets.add(to);
    e.edgeByTarget.set(to, edgeId);
  };
  const ids = new Set(m.states.map((s) => s.id));
  for (const edge of m.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    for (const sym of edge.symbols) add(edge.from, sym, edge.to, edge.id);
    if (edge.epsilon) add(edge.from, EPS, edge.to, edge.id);
  }
  return delta;
}

export function step(delta: Delta, from: string, sym: string): Set<string> {
  return delta.get(from)?.get(sym)?.targets ?? new Set();
}

export interface ClosureResult {
  states: Set<string>;
  /** Arestas ε efetivamente percorridas ao calcular o fecho (para destaque). */
  usedEdges: Set<string>;
}

/**
 * Fecho-ε E(R) (Sipser, prova do Teorema 1.39): estados alcançáveis a partir de R
 * percorrendo 0 ou mais arestas ε, incluindo os próprios membros de R.
 * Busca em largura com conjunto de visitados: ciclos ε não causam repetição infinita.
 */
export function epsilonClosure(delta: Delta, from: Iterable<string>): ClosureResult {
  const states = new Set<string>(from);
  const usedEdges = new Set<string>();
  const queue = [...states];
  while (queue.length > 0) {
    const q = queue.shift()!;
    const entry = delta.get(q)?.get(EPS);
    if (!entry) continue;
    for (const t of entry.targets) {
      const edgeId = entry.edgeByTarget.get(t);
      if (edgeId) usedEdges.add(edgeId);
      if (!states.has(t)) {
        states.add(t);
        queue.push(t);
      }
    }
  }
  return { states, usedEdges };
}

/** Estados alcançáveis a partir do inicial (por qualquer símbolo ou ε). */
export function reachableStates(m: FiniteAutomaton): Set<string> {
  const seen = new Set<string>();
  if (!m.initial || !m.states.some((s) => s.id === m.initial)) return seen;
  const adj = new Map<string, string[]>();
  for (const e of m.edges) {
    if (e.symbols.length === 0 && !e.epsilon) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const stack = [m.initial];
  seen.add(m.initial);
  while (stack.length) {
    const q = stack.pop()!;
    for (const t of adj.get(q) ?? []) {
      if (!seen.has(t)) {
        seen.add(t);
        stack.push(t);
      }
    }
  }
  return seen;
}
