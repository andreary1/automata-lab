import type { FAState } from '../fa/model';

/**
 * Autômato com pilha (Sipser, Definição 2.13): 6-upla (Q, Σ, Γ, δ, q0, F) com
 * δ: Q × Σε × Γε → P(Q × Γε).
 *
 * Representação (convenções do app, documentadas em docs/DECISOES.md):
 *  - cada aresta origem→destino guarda uma LISTA de transições "a, b → c";
 *  - `read`  = símbolo de Σ lido, ou null para ε (não lê);
 *  - `pop`   = símbolo de Γ desempilhado (deve estar no topo), ou null para ε (não desempilha);
 *  - `push`  = sequência de símbolos de Γ empilhados; [] = ε. Pela definição formal, empilha-se
 *    no máximo UM símbolo. Mais de um é a abreviação (r, u) ∈ δ(q, a, s) da prova do Lema 2.21
 *    (Figura 2.23): para u = u1…ul, u1 fica no TOPO (empilha-se ul primeiro, u1 por último).
 *  - A pilha é escrita como cadeia com o TOPO À ESQUERDA, como no livro (s = at, a no topo).
 *  - Aceitação padrão (livro): por estado de aceitação ao fim da entrada; a pilha começa vazia.
 *    Modo separado (não é o do livro): aceitação por pilha vazia, com pilha inicial opcional.
 */
export interface PDATransition {
  id: string;
  read: string | null;
  pop: string | null;
  push: string[];
}

export interface PDAEdge {
  id: string;
  from: string;
  to: string;
  transitions: PDATransition[];
}

export type PDAAcceptance = 'final' | 'empty';

export interface PDA {
  kind: 'pda';
  inputAlphabet: string[];
  stackAlphabet: string[];
  states: FAState[];
  edges: PDAEdge[];
  initial: string | null;
  acceptance: PDAAcceptance;
  /** Conteúdo inicial da pilha, topo à esquerda. Livro: vazio. */
  initialStack: string[];
}

export function emptyPDA(): PDA {
  return { kind: 'pda', inputAlphabet: ['a', 'b'], stackAlphabet: ['a', '$'], states: [], edges: [], initial: null, acceptance: 'final', initialStack: [] };
}

const isMulti = (syms: string[]) => syms.some((s) => [...s].length > 1);

/** Escreve uma cadeia de pilha (topo à esquerda); vazia = ε. */
export function formatStack(stack: string[], gamma: string[]): string {
  if (stack.length === 0) return 'ε';
  return isMulti(gamma) ? stack.join(' ') : stack.join('');
}

/** Rótulo de transição no estilo do livro: "a, b → c". */
export function transitionLabel(t: Pick<PDATransition, 'read' | 'pop' | 'push'>, gamma: string[]): string {
  return `${t.read ?? 'ε'}, ${t.pop ?? 'ε'} → ${formatStack(t.push, gamma)}`;
}
