import type { FAState } from '../fa/model';

/**
 * Máquina de Turing determinística de uma fita (Sipser, Definição 3.3):
 * 7-upla (Q, Σ, Γ, δ, q0, q_aceita, q_rejeita), δ: Q × Γ → Q × Γ × {E, D}.
 *
 * Convenções (docs/DECISOES.md):
 *  - O branco é "⊔"; pertence a Γ e nunca a Σ.
 *  - Γ é DERIVADO: Γ = Σ ∪ {símbolos extras da fita} ∪ {⊔}. Assim Σ ⊆ Γ sempre vale.
 *  - Fita infinita só à direita; o cabeçote começa na célula mais à esquerda. Mover para a
 *    esquerda na primeira célula mantém o cabeçote no lugar (p. 146).
 *  - Movimentos: só E (esquerda) e D (direita), como na Def. 3.3.
 *  - Pares (estado, símbolo) sem transição vão implicitamente para q_rejeita (convenção do
 *    livro, p. 152). O estado de rejeição pode ser desenhado ou ficar implícito.
 *  - A máquina para assim que entra em q_aceita ou q_rejeita.
 */
export const BLANK = '⊔';

export type TMMove = 'L' | 'R';
export const MOVE_LABEL: Record<TMMove, string> = { L: 'E', R: 'D' };

export interface TMTransition {
  id: string;
  read: string;
  write: string;
  move: TMMove;
}

export interface TMEdge {
  id: string;
  from: string;
  to: string;
  transitions: TMTransition[];
}

export interface TM {
  kind: 'tm';
  inputAlphabet: string[];
  /** Símbolos da fita além de Σ e do branco (ex.: marcas como x). */
  tapeSymbols: string[];
  states: FAState[];
  edges: TMEdge[];
  initial: string | null;
  acceptState: string | null;
  /** null = q_rejeita implícito (não desenhado), como na Figura 3.10. */
  rejectState: string | null;
}

export function emptyTM(): TM {
  return { kind: 'tm', inputAlphabet: ['0', '1'], tapeSymbols: ['x'], states: [], edges: [], initial: null, acceptState: null, rejectState: null };
}

/** Γ = Σ ∪ extras ∪ {⊔}, nessa ordem e sem repetição. */
export function tapeAlphabet(m: TM): string[] {
  const out: string[] = [];
  for (const s of [...m.inputAlphabet, ...m.tapeSymbols, BLANK]) if (!out.includes(s)) out.push(s);
  return out;
}

const multi = (syms: string[]) => syms.some((s) => [...s].length > 1);

/** Rótulo no estilo do livro: "0→⊔,D"; quando não escreve nada novo, abrevia "0→D". */
export function tmTransitionLabel(t: Pick<TMTransition, 'read' | 'write' | 'move'>): string {
  return t.write === t.read ? `${t.read}→${MOVE_LABEL[t.move]}` : `${t.read}→${t.write},${MOVE_LABEL[t.move]}`;
}

/**
 * Linhas do rótulo de uma seta, agrupando como o livro faz ("0,1,x→E") as transições que só
 * movem (escrevem o mesmo símbolo) na mesma direção.
 */
export function tmEdgeLabelLines(e: TMEdge): string[] {
  if (e.transitions.length === 0) return ['?'];
  const lines: string[] = [];
  const groups = new Map<TMMove, string[]>();
  for (const t of e.transitions) {
    if (t.write === t.read) groups.set(t.move, [...(groups.get(t.move) ?? []), t.read]);
    else lines.push(tmTransitionLabel(t));
  }
  for (const [move, reads] of groups) lines.unshift(`${reads.join(',')}→${MOVE_LABEL[move]}`);
  return lines;
}

/** Cadeia de símbolos da fita (com espaços se houver símbolos de vários caracteres). */
export function formatCells(cells: string[], gamma: string[]): string {
  return multi(gamma) ? cells.join(' ') : cells.join('');
}
