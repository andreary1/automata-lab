/**
 * Limites de recursos e cancelamento para algoritmos potencialmente caros
 * (a construção dos subconjuntos pode gerar 2^k estados).
 */
export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitError';
  }
}

export class CancelledError extends Error {
  constructor() {
    super('Operação cancelada pelo usuário.');
    this.name = 'CancelledError';
  }
}

export interface Budget {
  /** Máximo de estados em qualquer máquina produzida. */
  maxStates: number;
  /** Máximo de caracteres de uma expressão regular produzida. */
  maxRegexLength: number;
  shouldCancel?: () => boolean;
}

export const DEFAULT_BUDGET: Budget = { maxStates: 5000, maxRegexLength: 200_000 };

export function checkStates(b: Budget, n: number, what: string) {
  if (n > b.maxStates)
    throw new LimitError(`${what} ultrapassou o limite de ${b.maxStates} estados. O resultado não foi calculado; aumente o limite ou simplifique a máquina. Isso não significa que a operação seja impossível.`);
}

let tick = 0;
export function checkCancel(b: Budget) {
  if (b.shouldCancel && (++tick & 255) === 0 && b.shouldCancel()) throw new CancelledError();
}
