import { newId } from '../ids';
import type { PDA, PDAEdge, PDATransition } from './model';

/** Operações puras de edição de AP (devolvem uma nova máquina). */

export function ensurePDAEdge(m: PDA, from: string, to: string, init?: Omit<PDATransition, 'id'>): { machine: PDA; edgeId: string } {
  const existing = m.edges.find((e) => e.from === from && e.to === to);
  if (existing) return { machine: m, edgeId: existing.id };
  const edge: PDAEdge = { id: newId('e'), from, to, transitions: init ? [{ id: newId('t'), ...init }] : [] };
  return { machine: { ...m, edges: [...m.edges, edge] }, edgeId: edge.id };
}

export function addTransition(m: PDA, edgeId: string, t: Omit<PDATransition, 'id'>): { machine: PDA; transitionId: string } {
  const id = newId('t');
  return { machine: { ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, transitions: [...e.transitions, { id, ...t }] } : e)) }, transitionId: id };
}

export function updateTransition(m: PDA, edgeId: string, tid: string, patch: Partial<Omit<PDATransition, 'id'>>): PDA {
  return { ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, transitions: e.transitions.map((t) => (t.id === tid ? { ...t, ...patch } : t)) } : e)) };
}

export function removeTransition(m: PDA, edgeId: string, tid: string): PDA {
  return { ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, transitions: e.transitions.filter((t) => t.id !== tid) } : e)) };
}

/** Sugestão para nova transição: lê o primeiro símbolo de Σ, sem mexer na pilha. */
export function suggestTransition(m: PDA): Omit<PDATransition, 'id'> {
  return { read: m.inputAlphabet[0] ?? null, pop: null, push: [] };
}

/** Remove um símbolo de Σ e as transições que o leem. */
export function removeInputSymbol(m: PDA, sym: string): PDA {
  return { ...m, inputAlphabet: m.inputAlphabet.filter((a) => a !== sym), edges: m.edges.map((e) => ({ ...e, transitions: e.transitions.filter((t) => t.read !== sym) })) };
}

/** Remove um símbolo de Γ, as transições que o desempilham/empilham e ocorrências na pilha inicial. */
export function removeStackSymbol(m: PDA, sym: string): PDA {
  return {
    ...m,
    stackAlphabet: m.stackAlphabet.filter((a) => a !== sym),
    initialStack: m.initialStack.filter((a) => a !== sym),
    edges: m.edges.map((e) => ({ ...e, transitions: e.transitions.filter((t) => t.pop !== sym && !t.push.includes(sym)) })),
  };
}

export function renameInputSymbol(m: PDA, from: string, to: string): PDA {
  return { ...m, inputAlphabet: m.inputAlphabet.map((a) => (a === from ? to : a)), edges: m.edges.map((e) => ({ ...e, transitions: e.transitions.map((t) => (t.read === from ? { ...t, read: to } : t)) })) };
}

export function renameStackSymbol(m: PDA, from: string, to: string): PDA {
  const r = (a: string) => (a === from ? to : a);
  return {
    ...m,
    stackAlphabet: m.stackAlphabet.map(r),
    initialStack: m.initialStack.map(r),
    edges: m.edges.map((e) => ({ ...e, transitions: e.transitions.map((t) => ({ ...t, pop: t.pop === from ? to : t.pop, push: t.push.map(r) })) })),
  };
}

/** Quantas transições usam um símbolo (para confirmar remoções). */
export function usesOf(m: PDA, sym: string, where: 'input' | 'stack'): number {
  let n = 0;
  for (const e of m.edges) for (const t of e.transitions) if (where === 'input' ? t.read === sym : t.pop === sym || t.push.includes(sym)) n++;
  return n;
}
