import type { FAState } from './fa/model';

/**
 * Partes comuns a todo modelo desenhado como grafo (AF, AP e, depois, MT):
 * estados com id estável e posição, arestas origem→destino, estado inicial.
 * Operações de edição, layout e geometria trabalham sobre esta interface.
 */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

export interface GraphMachine {
  states: FAState[];
  edges: GraphEdge[];
  initial: string | null;
}
