import { DEFAULT_BUDGET, type Budget } from './budget';
import { opBinary, opComplement, opEquivalence, opMinimize, opNfaToDfa, opRegexToNfa, opStar, opToRegex, type BinaryOp, type Operand } from './api';
import type { FiniteAutomaton } from '../fa/model';

/** Pedidos serializáveis (para o Web Worker). */
export type RegularRequest = { budget?: Partial<Pick<Budget, 'maxStates' | 'maxRegexLength'>> } & (
  | { op: 'nfaToDfa'; machine: FiniteAutomaton; label: string }
  | { op: 'minimize'; machine: FiniteAutomaton; label: string }
  | { op: 'regexToNfa'; src: string; alphabet: string[] | null }
  | { op: 'toRegex'; machine: FiniteAutomaton; label: string; simplify: boolean; order: 'heuristic' | 'listed' }
  | { op: 'binary'; kind: BinaryOp; a: Operand; b: Operand }
  | { op: 'star'; a: Operand }
  | { op: 'complement'; a: Operand; alphabet: string[] }
  | { op: 'equivalence'; a: Operand; b: Operand }
);

export function executeRegular(req: RegularRequest, shouldCancel?: () => boolean) {
  const budget: Budget = { ...DEFAULT_BUDGET, ...req.budget, shouldCancel };
  switch (req.op) {
    case 'nfaToDfa':
      return opNfaToDfa(req.machine, req.label, budget);
    case 'minimize':
      return opMinimize(req.machine, req.label, budget);
    case 'regexToNfa':
      return opRegexToNfa(req.src, req.alphabet, budget);
    case 'toRegex':
      return opToRegex(req.machine, req.label, { simplify: req.simplify, order: req.order }, budget);
    case 'binary':
      return opBinary(req.kind, req.a, req.b, budget);
    case 'star':
      return opStar(req.a, budget);
    case 'complement':
      return opComplement(req.a, req.alphabet, budget);
    case 'equivalence':
      return opEquivalence(req.a, req.b, budget);
  }
}
