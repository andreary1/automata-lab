import type { FAEdge, FAState } from '../core/fa/model';
import type { GraphEdge, GraphMachine } from '../core/graph';

export const R = 26;

export interface EdgeGeom {
  path: string;
  labelX: number;
  labelY: number;
  /** Para rótulos de várias linhas: -1 cresce para cima, +1 para baixo, 0 centralizado. */
  grow: -1 | 0 | 1;
}

/** Posição (y) da primeira linha de um rótulo de `n` linhas, conforme a direção de crescimento. */
export function firstLineY(g: EdgeGeom, n: number, lineHeight = 15): number {
  if (n <= 1) return g.labelY;
  return g.grow < 0 ? g.labelY - (n - 1) * lineHeight : g.grow > 0 ? g.labelY : g.labelY - ((n - 1) * lineHeight) / 2;
}

export function edgeLabel(e: FAEdge): string {
  const parts = [...e.symbols];
  if (e.epsilon) parts.push('ε');
  return parts.length ? parts.join(', ') : '?';
}

/**
 * Geometria das arestas:
 *  - laço: arco acima do estado (ou abaixo, se houver mais vizinhos acima);
 *  - par em sentidos opostos: duas curvas simétricas, sem sobreposição;
 *  - caso comum: segmento reto entre as bordas dos círculos.
 * Transições paralelas no mesmo sentido não existem: são uma aresta com vários símbolos.
 */
export function edgeGeometry(m: GraphMachine, e: GraphEdge, byId: Map<string, FAState>): EdgeGeom | null {
  const a = byId.get(e.from);
  const b = byId.get(e.to);
  if (!a || !b) return null;
  if (a.id === b.id) {
    const neighborsAbove = m.edges.some((x) => x.from !== x.to && (x.from === a.id || x.to === a.id) && (byId.get(x.from === a.id ? x.to : x.from)?.y ?? Infinity) < a.y - 20);
    const dir = neighborsAbove ? 1 : -1;
    const sx = a.x - R * 0.6;
    const ex = a.x + R * 0.6;
    const sy = a.y + dir * R * 0.8;
    const cy = a.y + dir * (R + 52);
    return {
      path: `M ${sx} ${sy} C ${a.x - 38} ${cy}, ${a.x + 38} ${cy}, ${ex} ${sy}`,
      labelX: a.x,
      labelY: a.y + dir * (R + 46),
      grow: dir < 0 ? -1 : 1,
    };
  }
  const reverse = m.edges.some((x) => x.from === b.id && x.to === a.id && x.id !== e.id);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // Desvio de obstáculos: se o segmento reto passa perto de outro estado, curva para o lado oposto.
  let bend = reverse ? 28 : 0;
  if (!reverse) {
    for (const o of m.states) {
      if (o.id === a.id || o.id === b.id) continue;
      const t = ((o.x - a.x) * dx + (o.y - a.y) * dy) / (len * len);
      if (t <= 0.05 || t >= 0.95) continue;
      const px = a.x + t * dx - o.x;
      const py = a.y + t * dy - o.y;
      const dist = Math.hypot(px, py);
      if (dist < R + 14) {
        const side = px * nx + py * ny >= 0 ? 1 : -1;
        bend = side * (R + 22 - dist / 2);
        break;
      }
    }
  }
  const mx = (a.x + b.x) / 2 + nx * bend * 2;
  const my = (a.y + b.y) / 2 + ny * bend * 2;
  // pontos de borda: direção para o ponto de controle
  const trim = (p: FAState, cx: number, cy: number, extra: number) => {
    const vx = cx - p.x;
    const vy = cy - p.y;
    const l = Math.hypot(vx, vy) || 1;
    return [p.x + (vx / l) * (R + extra), p.y + (vy / l) * (R + extra)] as const;
  };
  const [sx, sy] = trim(a, mx, my, 0);
  const [tx, ty] = trim(b, mx, my, 2);
  // ponto da curva em t = 0,5 (quadrática)
  const lx = 0.25 * sx + 0.5 * mx + 0.25 * tx;
  const ly = 0.25 * sy + 0.5 * my + 0.25 * ty;
  const off = (bend < 0 ? -1 : 1) * (reverse ? 12 : 14);
  return {
    path: bend ? `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}` : `M ${sx} ${sy} L ${tx} ${ty}`,
    labelX: lx + nx * off,
    labelY: ly + ny * off,
    grow: ny * off < -0.3 ? -1 : ny * off > 0.3 ? 1 : 0,
  };
}

export function diagramBounds(m: GraphMachine): { x: number; y: number; w: number; h: number } {
  if (m.states.length === 0) return { x: 0, y: 0, w: 400, h: 300 };
  const xs = m.states.map((s) => s.x);
  const ys = m.states.map((s) => s.y);
  const pad = R + 70;
  const x = Math.min(...xs) - pad - 30;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
}
