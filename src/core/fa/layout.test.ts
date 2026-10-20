import { describe, expect, it } from 'vitest';
import { autoLayout } from './layout';
import { EXAMPLES } from '../examples';
import { PDA_EXAMPLES } from '../pda/examples';
import { TM_EXAMPLES } from '../tm/examples';
import type { GraphMachine } from '../graph';

function conflicts(m: GraphMachine, pos: Map<string, { x: number; y: number }>): string[] {
  const out: string[] = [];
  for (const s of m.states)
    for (const e of m.edges) {
      if (e.from === e.to || e.from === s.id || e.to === s.id) continue;
      const p = pos.get(s.id)!;
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)) < 30) out.push(`${s.id} sobre ${e.from}→${e.to}`);
    }
  return out;
}

describe('organização automática', () => {
  it('cadeia colinear com seta de volta: o estado do meio sai de cima da seta longa', () => {
    const st = (id: string) => ({ id, name: id, x: 0, y: 0, accepting: false });
    const m: GraphMachine = { states: [st('a'), st('b'), st('c')], initial: 'a', edges: [{ id: '1', from: 'a', to: 'b' }, { id: '2', from: 'b', to: 'c' }, { id: '3', from: 'c', to: 'a' }] };
    expect(conflicts(m, autoLayout(m))).toEqual([]);
  });
  it('nenhum exemplo fica com estado sobre seta alheia', () => {
    for (const e of [...EXAMPLES, ...PDA_EXAMPLES, ...TM_EXAMPLES]) expect(conflicts(e.machine, autoLayout(e.machine)), e.key).toEqual([]);
  });
});
