import type { FiniteAutomaton } from './model';

/**
 * Organização automática em camadas (algoritmo complementar, não do livro):
 * camada = distância BFS a partir do estado inicial; estados inalcançáveis vão
 * para uma camada final. Dentro de cada camada, ordena pela média das posições
 * dos predecessores (heurística de baricentro, uma passada) para reduzir cruzamentos.
 */
export function autoLayout(m: FiniteAutomaton, opts: { dx?: number; dy?: number } = {}): Map<string, { x: number; y: number }> {
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
  return pos;
}
