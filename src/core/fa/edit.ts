import { buildDelta } from './delta';
import type { FAEdge, FAState, FiniteAutomaton } from './model';
import { newId } from '../ids';

/**
 * Operações puras de edição. Todas devolvem uma NOVA máquina (imutabilidade
 * facilita desfazer/refazer).
 */

export function nextStateName(m: FiniteAutomaton, prefix = 'q'): string {
  const used = new Set(m.states.map((s) => s.name));
  for (let i = 0; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

export function addState(m: FiniteAutomaton, x: number, y: number, id = newId('s')): FiniteAutomaton {
  const s: FAState = { id, name: nextStateName(m), x, y, accepting: false };
  return { ...m, states: [...m.states, s], initial: m.initial ?? id };
}

export function updateState(m: FiniteAutomaton, id: string, patch: Partial<Omit<FAState, 'id'>>): FiniteAutomaton {
  return { ...m, states: m.states.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function moveStates(m: FiniteAutomaton, moves: Map<string, { x: number; y: number }>): FiniteAutomaton {
  return { ...m, states: m.states.map((s) => (moves.has(s.id) ? { ...s, ...moves.get(s.id)! } : s)) };
}

export function deleteStates(m: FiniteAutomaton, ids: Set<string>): FiniteAutomaton {
  return {
    ...m,
    states: m.states.filter((s) => !ids.has(s.id)),
    edges: m.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)),
    initial: m.initial && ids.has(m.initial) ? null : m.initial,
  };
}

export function findEdge(m: FiniteAutomaton, from: string, to: string): FAEdge | undefined {
  return m.edges.find((e) => e.from === from && e.to === to);
}

/** Cria (ou reaproveita) a aresta from→to. Devolve a máquina e o id da aresta. */
export function ensureEdge(m: FiniteAutomaton, from: string, to: string, init?: { symbols?: string[]; epsilon?: boolean }): { machine: FiniteAutomaton; edgeId: string } {
  const existing = findEdge(m, from, to);
  if (existing) return { machine: m, edgeId: existing.id };
  const edge: FAEdge = { id: newId('e'), from, to, symbols: init?.symbols ?? [], epsilon: init?.epsilon ?? false };
  return { machine: { ...m, edges: [...m.edges, edge] }, edgeId: edge.id };
}

export function updateEdge(m: FiniteAutomaton, id: string, patch: Partial<Pick<FAEdge, 'symbols' | 'epsilon'>>): FiniteAutomaton {
  return { ...m, edges: m.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export function deleteEdges(m: FiniteAutomaton, ids: Set<string>): FiniteAutomaton {
  return { ...m, edges: m.edges.filter((e) => !ids.has(e.id)) };
}

/**
 * Símbolos a sugerir para uma nova aresta: o primeiro símbolo de Σ que ainda
 * não sai do estado de origem (útil em AFD). Pode ser vazio.
 */
export function suggestSymbols(m: FiniteAutomaton, from: string): string[] {
  const used = new Set(m.edges.filter((e) => e.from === from).flatMap((e) => e.symbols));
  const free = m.alphabet.find((a) => !used.has(a));
  return free ? [free] : [];
}

/** Lista os pares (estado, símbolo) sem transição. */
export function missingTransitions(m: FiniteAutomaton): { state: string; symbol: string }[] {
  const delta = buildDelta(m);
  const out: { state: string; symbol: string }[] = [];
  for (const s of m.states) for (const a of m.alphabet) if (!delta.get(s.id)?.get(a)?.targets.size) out.push({ state: s.id, symbol: a });
  return out;
}

/**
 * Completa um AFD com um estado poço explícito: um estado de não aceitação com
 * laço em todos os símbolos, que recebe toda transição ausente. A linguagem não muda
 * (o poço não é de aceitação e nunca sai dele). Só é chamada por ação explícita do usuário.
 */
export function completeWithSink(m: FiniteAutomaton): { machine: FiniteAutomaton; sinkId: string | null } {
  const missing = missingTransitions(m);
  if (missing.length === 0 || m.alphabet.length === 0) return { machine: m, sinkId: null };
  const used = new Set(m.states.map((s) => s.name));
  let name = 'poço';
  for (let i = 1; used.has(name); i++) name = `poço${i}`;
  const maxX = Math.max(0, ...m.states.map((s) => s.x));
  const avgY = m.states.length ? m.states.reduce((a, s) => a + s.y, 0) / m.states.length : 0;
  const sinkId = newId('s');
  let out: FiniteAutomaton = { ...m, states: [...m.states, { id: sinkId, name, x: maxX + 160, y: avgY + 120, accepting: false }] };
  const byState = new Map<string, string[]>();
  for (const x of missing) byState.set(x.state, [...(byState.get(x.state) ?? []), x.symbol]);
  for (const [from, syms] of byState) {
    const r = ensureEdge(out, from, sinkId);
    out = r.machine;
    const e = out.edges.find((x) => x.id === r.edgeId)!;
    out = updateEdge(out, e.id, { symbols: [...e.symbols, ...syms] });
  }
  const loop = ensureEdge(out, sinkId, sinkId);
  out = updateEdge(loop.machine, loop.edgeId, { symbols: [...m.alphabet] });
  return { machine: out, sinkId };
}

/** Remove símbolo de Σ e de todas as arestas. */
export function removeSymbolEverywhere(m: FiniteAutomaton, sym: string): FiniteAutomaton {
  return { ...m, alphabet: m.alphabet.filter((a) => a !== sym), edges: m.edges.map((e) => ({ ...e, symbols: e.symbols.filter((s) => s !== sym) })) };
}

/** Renomeia símbolo em Σ e nas arestas (ids de estados não mudam). */
export function renameSymbol(m: FiniteAutomaton, from: string, to: string): FiniteAutomaton {
  return {
    ...m,
    alphabet: m.alphabet.map((a) => (a === from ? to : a)),
    edges: m.edges.map((e) => ({ ...e, symbols: e.symbols.map((s) => (s === from ? to : s)) })),
  };
}
