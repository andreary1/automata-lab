import type { GraphMachine } from '../graph';

/**
 * Organização automática em camadas (algoritmo complementar, não do livro):
 * camada = distância BFS a partir do estado inicial; estados inalcançáveis vão
 * para uma camada final. Dentro de cada camada, ordena pela média das posições
 * dos predecessores (heurística de baricentro, uma passada) para reduzir cruzamentos.
 */
export function autoLayout(m: GraphMachine, opts: { dx?: number; dy?: number } = {}): Map<string, { x: number; y: number }> {
  const dx = opts.dx ?? 170;
  const dy = opts.dy ?? 120;
  const adj = new Map<string, string[]>();
  for (const e of m.edges) {
    if (e.from === e.to) continue;
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  }
  const layer = new Map<string, number>();
  const order: string[] = [];
  const start = m.initial && m.states.some((s) => s.id === m.initial) ? m.initial : m.states[0]?.id;
  if (start) {
    layer.set(start, 0);
    const q = [start];
    while (q.length) {
      const v = q.shift()!;
      order.push(v);
      for (const t of adj.get(v) ?? []) {
        if (!layer.has(t)) {
          layer.set(t, layer.get(v)! + 1);
          q.push(t);
        }
      }
    }
  }
  const maxLayer = Math.max(0, ...layer.values());
  for (const s of m.states) {
    if (!layer.has(s.id)) {
      layer.set(s.id, maxLayer + 1);
      order.push(s.id);
    }
  }
  const layers: string[][] = [];
  for (const id of order) {
    const l = layer.get(id)!;
    (layers[l] ??= []).push(id);
  }
  const pos = new Map<string, { x: number; y: number }>();
  const preds = new Map<string, string[]>();
  for (const [f, ts] of adj) for (const t of ts) preds.set(t, [...(preds.get(t) ?? []), f]);
  layers.forEach((ids, li) => {
    if (!ids) return;
    if (li > 0) {
      const score = (id: string) => {
        const ps = (preds.get(id) ?? []).map((p) => pos.get(p)?.y).filter((v): v is number => v !== undefined);
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
      };
      ids.sort((a, b) => score(a) - score(b));
    }
    const h = (ids.length - 1) * dy;
    ids.forEach((id, i) => pos.set(id, { x: 100 + li * dx, y: 200 - h / 2 + i * dy }));
  });
  untangle(m, pos, dy);
  return pos;
}

/** Distância do ponto p ao segmento ab. */
function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): { d: number; side: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
  const cx = a.x + t * vx;
  const cy = a.y + t * vy;
  return { d: Math.hypot(p.x - cx, p.y - cy), side: Math.sign(p.y - cy) };
}

/**
 * Pós-processamento: estados não podem ficar sobre (ou rentes a) uma seta que não é deles, e o
 * rótulo de um laço (desenhado acima do estado) não pode encostar numa seta alheia. Isso acontece
 * em cadeias colineares (q0 → q1 → q2 com q0 → q2). O estado é empurrado verticalmente para longe
 * da seta, algumas vezes, até não haver conflito.
 */
export function untangle(m: GraphMachine, pos: Map<string, { x: number; y: number }>, dy = 120) {
  const CLEAR = 42; // raio do estado + folga
  const LABEL_CLEAR = 26;
  const loops = new Set(m.edges.filter((e) => e.from === e.to).map((e) => e.from));
  const segs = m.edges.filter((e) => e.from !== e.to);
  const push = Math.round(dy * 0.45);
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const s of m.states) {
      const p = pos.get(s.id);
      if (!p) continue;
      for (const e of segs) {
        if (e.from === s.id || e.to === s.id) continue;
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) continue;
        const body = segDist(p, a, b);
        const label = loops.has(s.id) ? segDist({ x: p.x, y: p.y - 58 }, a, b) : null;
        if (body.d < CLEAR) {
          p.y += (body.side || (pass % 2 ? -1 : 1)) * push;
          moved = true;
        } else if (label && label.d < LABEL_CLEAR) {
          p.y += label.side <= 0 ? push : -push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}
