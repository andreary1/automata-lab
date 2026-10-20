import { newId } from '../ids';
import { BLANK, type TM, type TMEdge, type TMTransition } from './model';

/** Operações puras de edição de MT (devolvem uma nova máquina). */

export function ensureTMEdge(m: TM, from: string, to: string, init?: Omit<TMTransition, 'id'>): { machine: TM; edgeId: string } {
  const existing = m.edges.find((e) => e.from === from && e.to === to);
  if (existing) return { machine: m, edgeId: existing.id };
  const edge: TMEdge = { id: newId('e'), from, to, transitions: init ? [{ id: newId('t'), ...init }] : [] };
  return { machine: { ...m, edges: [...m.edges, edge] }, edgeId: edge.id };
}

export function addTMTransition(m: TM, edgeId: string, t: Omit<TMTransition, 'id'>): { machine: TM; transitionId: string } {
  const id = newId('t');
  return { machine: { ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, transitions: [...e.transitions, { id, ...t }] } : e)) }, transitionId: id };
}

export function updateTMTransition(m: TM, edgeId: string, tid: string, patch: Partial<Omit<TMTransition, 'id'>>): TM {
  return { ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, transitions: e.transitions.map((t) => (t.id === tid ? { ...t, ...patch } : t)) } : e)) };
}

export function removeTMTransition(m: TM, edgeId: string, tid: string): TM {
  return { ...m, edges: m.edges.map((e) => (e.id === edgeId ? { ...e, transitions: e.transitions.filter((t) => t.id !== tid) } : e)) };
}

/** Símbolos já lidos por transições que saem de `from` (para sugerir um ainda livre). */
export function usedReads(m: TM, from: string): Set<string> {
  const s = new Set<string>();
  for (const e of m.edges) if (e.from === from) for (const t of e.transitions) s.add(t.read);
  return s;
}

/** Sugestão: lê o primeiro símbolo de Γ ainda sem transição neste estado, não escreve nada novo, move à direita. */
export function suggestTMTransition(m: TM, from: string): Omit<TMTransition, 'id'> {
  const used = usedReads(m, from);
  const gamma = [...m.inputAlphabet, ...m.tapeSymbols, BLANK];
  const read = gamma.find((g) => !used.has(g)) ?? gamma[0];
  return { read, write: read, move: 'R' };
}

/** Remove um símbolo de Σ ou dos extras de Γ e todas as transições que o leem ou escrevem. */
export function removeTMSymbol(m: TM, sym: string): TM {
  return {
    ...m,
    inputAlphabet: m.inputAlphabet.filter((a) => a !== sym),
    tapeSymbols: m.tapeSymbols.filter((a) => a !== sym),
    edges: m.edges.map((e) => ({ ...e, transitions: e.transitions.filter((t) => t.read !== sym && t.write !== sym) })),
  };
}

export function renameTMSymbol(m: TM, from: string, to: string): TM {
  const r = (a: string) => (a === from ? to : a);
  return {
    ...m,
    inputAlphabet: m.inputAlphabet.map(r),
    tapeSymbols: m.tapeSymbols.map(r),
    edges: m.edges.map((e) => ({ ...e, transitions: e.transitions.map((t) => ({ ...t, read: r(t.read), write: r(t.write) })) })),
  };
}

export function tmUsesOf(m: TM, sym: string): number {
  let n = 0;
  for (const e of m.edges) for (const t of e.transitions) if (t.read === sym || t.write === sym) n++;
  return n;
}

/** Define o papel de parada de um estado (aceitação / rejeição / nenhum). */
export function setHaltRole(m: TM, stateId: string, role: 'accept' | 'reject' | 'none'): TM {
  let { acceptState, rejectState } = m;
  if (acceptState === stateId) acceptState = null;
  if (rejectState === stateId) rejectState = null;
  if (role === 'accept') acceptState = stateId;
  if (role === 'reject') rejectState = stateId;
  return { ...m, acceptState, rejectState };
}
