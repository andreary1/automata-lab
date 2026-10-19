import { buildDelta, EPS } from './delta';
import type { FiniteAutomaton } from './model';

export interface TableCell {
  targets: string[];
  /** AFD: 0 destinos (ausente) ou >1 (conflito). */
  problem?: 'missing' | 'conflict';
}

export interface TransitionTable {
  columns: { key: string; label: string }[];
  rows: { stateId: string; name: string; initial: boolean; accepting: boolean; cells: TableCell[] }[];
}

/** Tabela de δ derivada da mesma estrutura que o diagrama. AFN inclui a coluna ε. */
export function transitionTable(m: FiniteAutomaton): TransitionTable {
  const delta = buildDelta(m);
  const columns = m.alphabet.map((a) => ({ key: a, label: a }));
  if (m.kind === 'nfa' || m.edges.some((e) => e.epsilon)) columns.push({ key: EPS, label: 'ε' });
  const order = new Map(m.states.map((s, i) => [s.id, i]));
  return {
    columns,
    rows: m.states.map((s) => ({
      stateId: s.id,
      name: s.name,
      initial: s.id === m.initial,
      accepting: s.accepting,
      cells: columns.map((c) => {
        const targets = [...(delta.get(s.id)?.get(c.key)?.targets ?? [])].sort((a, b) => order.get(a)! - order.get(b)!);
        let problem: TableCell['problem'];
        if (m.kind === 'dfa' && c.key !== EPS) problem = targets.length === 0 ? 'missing' : targets.length > 1 ? 'conflict' : undefined;
        return { targets, problem };
      }),
    })),
  };
}
