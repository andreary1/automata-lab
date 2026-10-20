import type { FAEdge, FiniteAutomaton } from './fa/model';
import { validate, type ValidationReport } from './fa/validate';
import type { PDA, PDAEdge } from './pda/model';
import { transitionLabel } from './pda/model';
import { validatePDA } from './pda/validate';
import { tmEdgeLabelLines, type TM, type TMEdge } from './tm/model';
import { validateTM } from './tm/validate';

/** Todos os modelos editáveis. */
export type Machine = FiniteAutomaton | PDA | TM;
export type MachineKind = Machine['kind'];

export const isPDA = (m: Machine): m is PDA => m.kind === 'pda';
export const isTM = (m: Machine): m is TM => m.kind === 'tm';
export const isFA = (m: Machine): m is FiniteAutomaton => m.kind === 'dfa' || m.kind === 'nfa';

export const KIND_LABEL: Record<MachineKind, string> = { dfa: 'AFD', nfa: 'AFN', pda: 'AP', tm: 'MT' };

export function validateMachine(m: Machine): ValidationReport {
  return isPDA(m) ? validatePDA(m) : isTM(m) ? validateTM(m) : validate(m);
}

/** Alfabeto de ENTRADA (usado para dividir cadeias em símbolos). */
export function inputAlphabet(m: Machine): string[] {
  return isFA(m) ? m.alphabet : m.inputAlphabet;
}

/** Rótulo da aresta em linhas (AP e MT: uma transição por linha, como no livro). */
export function edgeLabelLines(m: Machine, edgeId: string): string[] {
  if (isPDA(m)) {
    const e = m.edges.find((x) => x.id === edgeId) as PDAEdge | undefined;
    if (!e || e.transitions.length === 0) return ['?'];
    return e.transitions.map((t) => transitionLabel(t, m.stackAlphabet));
  }
  if (isTM(m)) {
    const e = m.edges.find((x) => x.id === edgeId) as TMEdge | undefined;
    return e ? tmEdgeLabelLines(e) : ['?'];
  }
  const e = m.edges.find((x) => x.id === edgeId) as FAEdge | undefined;
  if (!e) return ['?'];
  const parts = [...e.symbols];
  if (e.epsilon) parts.push('ε');
  return [parts.length ? parts.join(', ') : '?'];
}

export function isEdgeEmpty(m: Machine, edgeId: string): boolean {
  if (!isFA(m)) return (m.edges.find((x) => x.id === edgeId)?.transitions.length ?? 0) === 0;
  const e = m.edges.find((x) => x.id === edgeId);
  return !!e && e.symbols.length === 0 && !e.epsilon;
}

/** Estado é "de aceitação" no desenho (círculo duplo): F para AF/AP, q_aceita para MT. */
export function isAcceptingState(m: Machine, id: string): boolean {
  if (isTM(m)) return m.acceptState === id;
  return !!m.states.find((s) => s.id === id)?.accepting;
}
