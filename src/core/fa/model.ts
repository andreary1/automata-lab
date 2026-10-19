/**
 * Representação única de um autômato finito (AFD ou AFN).
 *
 * Fundamentação (Sipser, Def. 1.5 e Def. 1.37): um autômato finito é uma
 * 5-upla (Q, Σ, δ, q0, F). Aqui:
 *  - Q  → `states` (cada estado tem um `id` estável; `name` é apenas rótulo);
 *  - Σ  → `alphabet` (lista ordenada de símbolos, sem repetição);
 *  - δ  → derivada de `edges` (ver `delta.ts`);
 *  - q0 → `initial` (id ou null enquanto rascunho);
 *  - F  → estados com `accepting = true`.
 *
 * Convenção do app: as transições são guardadas como ARESTAS do diagrama
 * (um par origem/destino com um conjunto de símbolos e, opcionalmente, ε).
 * Existe no máximo uma aresta por par (origem, destino). Isso mantém
 * diagrama, tabela e definição formal derivados da mesma estrutura.
 */

export type FAKind = 'dfa' | 'nfa';

export interface FAState {
  id: string;
  name: string;
  x: number;
  y: number;
  accepting: boolean;
}

export interface FAEdge {
  id: string;
  from: string;
  to: string;
  /** Símbolos de Σ que rotulam esta aresta (ordem preservada para exibição). */
  symbols: string[];
  /** Se a aresta também é rotulada por ε (só faz sentido em AFN). */
  epsilon: boolean;
}

export interface FiniteAutomaton {
  kind: FAKind;
  alphabet: string[];
  states: FAState[];
  edges: FAEdge[];
  initial: string | null;
}

export const EPSILON_LABEL = 'ε';
export const EMPTYSET_LABEL = '∅';

export function emptyAutomaton(kind: FAKind = 'dfa'): FiniteAutomaton {
  return { kind, alphabet: ['0', '1'], states: [], edges: [], initial: null };
}

export function stateById(m: FiniteAutomaton): Map<string, FAState> {
  return new Map(m.states.map((s) => [s.id, s]));
}

export function stateName(m: FiniteAutomaton, id: string): string {
  return m.states.find((s) => s.id === id)?.name ?? `?${id}`;
}

/** Formata um conjunto de estados como {q1, q2} (ou ∅), em ordem de `states`. */
export function formatStateSet(m: FiniteAutomaton, ids: Iterable<string>): string {
  const set = new Set(ids);
  if (set.size === 0) return EMPTYSET_LABEL;
  const names = m.states.filter((s) => set.has(s.id)).map((s) => s.name);
  return `{${names.join(', ')}}`;
}
