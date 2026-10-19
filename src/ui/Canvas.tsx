import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addState, ensureEdge, moveStates, suggestSymbols } from '../core/fa/edit';
import { edgeLabelLines, isEdgeEmpty, isPDA, validateMachine, type Machine } from '../core/machine';
import { ensurePDAEdge, suggestTransition } from '../core/pda/edit';
import type { SimState } from '../state/store';
import { useApp } from '../state/store';
import { diagramBounds, edgeGeometry, firstLineY, R } from './geometry';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'move'; sx: number; sy: number; origins: Map<string, { x: number; y: number }>; moved: boolean }
  | { kind: 'edge'; from: string; sx: number; sy: number; moved: boolean };

const snap = (v: number) => Math.round(v / 10) * 10;

/** Fonte menor para nomes longos (ex.: subconjuntos {q1, q2, q3}); acima de 11 caracteres o nome é abreviado e aparece completo na dica. */
function nameSize(name: string): number {
  const n = [...name].length;
  return n <= 3 ? 14 : n <= 5 ? 12.5 : n <= 7 ? 10.5 : 8.5;
}

export function createEdge(from: string, to: string) {
  const st = useApp.getState();
  let edgeId = '';
  st.apply((m) => {
    const existing = m.edges.find((e) => e.from === from && e.to === to);
    if (existing) {
      edgeId = existing.id;
      return m;
    }
    const r = isPDA(m) ? ensurePDAEdge(m, from, to, suggestTransition(m)) : ensureEdge(m, from, to, { symbols: suggestSymbols(m, from) });
    edgeId = r.edgeId;
    return r.machine;
  });
  useApp.getState().select({ edges: [edgeId] });
}

export function Canvas({ svgRef }: { svgRef: React.RefObject<SVGSVGElement> }) {
  const m = useApp((s) => s.project.machine);
  const view = useApp((s) => s.view);
  const tool = useApp((s) => s.tool);
  const selection = useApp((s) => s.selection);
  const pending = useApp((s) => s.pendingEdgeFrom);
  const sim = useApp((s) => s.sim);
  const fitTick = useApp((s) => s.fitTick);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [temp, setTemp] = useState<{ from: string; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const byId = useMemo(() => new Map(m.states.map((s) => [s.id, s])), [m.states]);
  const report = useMemo(() => validateMachine(m), [m]);
  const issueStates = useMemo(() => new Set(report.issues.filter((i) => i.severity !== 'info').flatMap((i) => i.stateIds ?? [])), [report]);
  const issueEdges = useMemo(() => new Set(report.issues.filter((i) => i.severity !== 'info').flatMap((i) => i.edgeIds ?? [])), [report]);

  const { activeCount, usedEdges } = useMemo(() => highlights(m, sim), [m, sim]);
  const activeStates = new Set(activeCount.keys());

  const toWorld = useCallback(
    (cx: number, cy: number) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const v = useApp.getState().view;
      return { x: (cx - rect.left - v.x) / v.k, y: (cy - rect.top - v.y) / v.k };
    },
    [svgRef],
  );

  const hitState = (wx: number, wy: number): string | null => {
    const states = useApp.getState().project.machine.states;
    for (let i = states.length - 1; i >= 0; i--) {
      const s = states[i];
      if (Math.hypot(s.x - wx, s.y - wy) <= R + 4) return s.id;
    }
    return null;
  };

  // Ajustar à tela
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const b = diagramBounds(useApp.getState().project.machine);
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (W === 0 || H === 0) return;
    const k = Math.max(0.3, Math.min(1.6, Math.min(W / b.w, H / b.h)));
    useApp.getState().setView({ k, x: (W - b.w * k) / 2 - b.x * k, y: (H - b.h * k) / 2 - b.y * k });
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fitTick, fit]);

  // Zoom com a roda do mouse (listener não passivo para impedir rolagem da página)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const v = useApp.getState().view;
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
      const k = Math.max(0.2, Math.min(3, v.k * factor));
      useApp.getState().setView({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef]);

  const onBgDown = (ev: React.PointerEvent) => {
    if (ev.button === 2) return;
    const st = useApp.getState();
    const w = toWorld(ev.clientX, ev.clientY);
    svgRef.current?.setPointerCapture(ev.pointerId);
    if (ev.button === 1 || tool === 'select' || tool === 'edge') {
      if (tool === 'edge' && st.pendingEdgeFrom) st.setPendingEdgeFrom(null);
      if (!ev.shiftKey && ev.button !== 1) st.clearSelection();
      drag.current = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y };
      return;
    }
    if (tool === 'state') {
      let newId = '';
      st.apply((mm) => {
        const out = addState(mm, snap(w.x), snap(w.y));
        newId = out.states[out.states.length - 1].id;
        return out;
      });
      st.select({ states: [newId] });
    }
  };

  const onStateDown = (ev: React.PointerEvent, id: string) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    const st = useApp.getState();
    svgRef.current?.setPointerCapture(ev.pointerId);
    if (tool === 'edge') {
      if (st.pendingEdgeFrom) {
        createEdge(st.pendingEdgeFrom, id);
        st.setPendingEdgeFrom(null);
        return;
      }
      const w = toWorld(ev.clientX, ev.clientY);
      drag.current = { kind: 'edge', from: id, sx: ev.clientX, sy: ev.clientY, moved: false };
      setTemp({ from: id, x: w.x, y: w.y });
      return;
    }
    let sel = st.selection.states;
    if (ev.shiftKey) {
      st.select({ states: [id] }, true);
      sel = useApp.getState().selection.states;
    } else if (!sel.includes(id)) {
      st.select({ states: [id] });
      sel = [id];
    }
    const machine = st.project.machine;
    const origins = new Map(machine.states.filter((s) => sel.includes(s.id)).map((s) => [s.id, { x: s.x, y: s.y }]));
    st.beginTransient();
    drag.current = { kind: 'move', sx: ev.clientX, sy: ev.clientY, origins, moved: false };
  };

  const onEdgeDown = (ev: React.PointerEvent, id: string) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    useApp.getState().select({ edges: [id] }, ev.shiftKey);
  };

  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    const w = toWorld(ev.clientX, ev.clientY);
    if (tool === 'edge' && pending) setHover(w);
    if (!d) return;
    const st = useApp.getState();
    if (d.kind === 'pan') {
      st.setView({ ...st.view, x: d.vx + ev.clientX - d.sx, y: d.vy + ev.clientY - d.sy });
    } else if (d.kind === 'move') {
      const k = st.view.k;
      const dx = (ev.clientX - d.sx) / k;
      const dy = (ev.clientY - d.sy) / k;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      const moves = new Map<string, { x: number; y: number }>();
      for (const [id, o] of d.origins) moves.set(id, { x: ev.altKey ? o.x + dx : snap(o.x + dx), y: ev.altKey ? o.y + dy : snap(o.y + dy) });
      st.applyTransient((mm) => moveStates(mm, moves));
    } else if (d.kind === 'edge') {
      if (Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 6) d.moved = true;
      setTemp({ from: d.from, x: w.x, y: w.y });
    }
  };

  const onUp = (ev: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const st = useApp.getState();
    if (d.kind === 'move') st.endTransient();
    if (d.kind === 'edge') {
      setTemp(null);
      const w = toWorld(ev.clientX, ev.clientY);
      const target = hitState(w.x, w.y);
      if (target && (target !== d.from || d.moved)) createEdge(d.from, target);
      else if (target === d.from && !d.moved) st.setPendingEdgeFrom(d.from);
    }
  };

  const onDouble = (ev: React.MouseEvent) => {
    const w = toWorld(ev.clientX, ev.clientY);
    const hit = hitState(w.x, w.y);
    const st = useApp.getState();
    if (hit) {
      st.select({ states: [hit] });
      st.requestFocusName();
    } else if (tool === 'select') {
      let newId = '';
      st.apply((mm) => {
        const out = addState(mm, snap(w.x), snap(w.y));
        newId = out.states[out.states.length - 1].id;
        return out;
      });
      st.select({ states: [newId] });
    }
  };

  const pendingState = pending ? byId.get(pending) : undefined;
  const tempFrom = temp ? byId.get(temp.from) : undefined;

  return (
    <div className={`canvas-wrap tool-${tool}`} ref={wrapRef}>
      <svg
        ref={svgRef}
        className="canvas"
        role="application"
        aria-label="Diagrama do autômato. Use o painel à direita ou o teclado para editar."
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onDouble}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid" width={20 * view.k} height={20 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
            <circle cx={1} cy={1} r={1} className="grid-dot" />
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead" />
          </marker>
          <marker id="arrow-used" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead used" />
          </marker>
          <marker id="arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead selected" />
          </marker>
        </defs>
        <rect className="grid-bg" width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g className="diagram-content">
            {m.edges.map((e) => {
              const g = edgeGeometry(m, e, byId);
              if (!g) return null;
              const sel = selection.edges.includes(e.id);
              const used = usedEdges.has(e.id);
              const issue = issueEdges.has(e.id);
              const cls = ['edge', sel && 'selected', used && 'used', issue && 'issue', isEdgeEmpty(m, e.id) && 'empty'].filter(Boolean).join(' ');
              return (
                <g key={e.id} className={cls} onPointerDown={(ev) => onEdgeDown(ev, e.id)}>
                  <path d={g.path} className="edge-hit" />
                  <path d={g.path} className="edge-line" markerEnd={`url(#${used ? 'arrow-used' : sel ? 'arrow-sel' : 'arrow'})`} />
                </g>
              );
            })}
            {m.states.map((s) => {
              const sel = selection.states.includes(s.id);
              const active = activeStates.has(s.id);
              const issue = issueStates.has(s.id);
              const initial = m.initial === s.id;
              const cls = ['state', sel && 'selected', active && 'active', issue && 'issue', s.accepting && 'accepting', pending === s.id && 'pending'].filter(Boolean).join(' ');
              const label = `Estado ${s.name}${initial ? ', inicial' : ''}${s.accepting ? ', de aceitação' : ''}${active ? ', ativo na simulação' : ''}`;
              return (
                <g
                  key={s.id}
                  className={cls}
                  transform={`translate(${s.x} ${s.y})`}
                  onPointerDown={(ev) => onStateDown(ev, s.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={label}
                  aria-pressed={sel}
                  data-state-id={s.id}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      useApp.getState().select({ states: [s.id] }, ev.shiftKey);
                    }
                  }}
                >
                  {initial && <path d={`M ${-R - 42} 0 L ${-R - 2} 0`} className="initial-arrow" markerEnd="url(#arrow)" />}
                  {sel && <circle r={R + 7} className="halo" />}
                  <circle r={R} className="state-circle" />
                  {s.accepting && <circle r={R - 5} className="state-inner" />}
                  <title>{s.name}</title>
                  <text className="state-name" dy="0.35em" style={{ fontSize: nameSize(s.name) }}>
                    {[...s.name].length > 11 ? [...s.name].slice(0, 10).join('') + '…' : s.name}
                  </text>
                  {active && (
                    <g className="active-badge" transform={`translate(${R * 0.72} ${-R * 0.72})`}>
                      <circle r={8} />
                      <text dy="0.35em">{(activeCount.get(s.id) ?? 0) > 1 ? Math.min(activeCount.get(s.id)!, 99) : '●'}</text>
                      {(activeCount.get(s.id) ?? 0) > 1 && <title>{`${activeCount.get(s.id)} configurações neste estado (pilhas diferentes)`}</title>}
                    </g>
                  )}
                  {issue && !active && (
                    <g className="issue-badge" transform={`translate(${R * 0.72} ${-R * 0.72})`}>
                      <circle r={8} />
                      <text dy="0.35em">!</text>
                    </g>
                  )}
                </g>
              );
            })}
            {m.edges.map((e) => {
              const g = edgeGeometry(m, e, byId);
              if (!g) return null;
              const used = usedEdges.has(e.id);
              const sel = selection.edges.includes(e.id);
              const lines = edgeLabelLines(m, e.id);
              const y0 = firstLineY(g, lines.length);
              return (
                <text
                  key={`l-${e.id}`}
                  x={g.labelX}
                  y={y0}
                  dy="0.35em"
                  className={`edge-label${used ? ' used' : ''}${sel ? ' selected' : ''}${issueEdges.has(e.id) ? ' issue' : ''}`}
                  onPointerDown={(ev) => onEdgeDown(ev, e.id)}
                >
                  {lines.length === 1
                    ? lines[0]
                    : lines.map((l, i) => (
                        <tspan key={i} x={g.labelX} dy={i === 0 ? '0.35em' : 15}>
                          {l}
                        </tspan>
                      ))}
                </text>
              );
            })}
          </g>
          {tempFrom && temp && <line className="temp-edge" x1={tempFrom.x} y1={tempFrom.y} x2={temp.x} y2={temp.y} />}
          {pendingState && hover && <line className="temp-edge" x1={pendingState.x} y1={pendingState.y} x2={hover.x} y2={hover.y} />}
        </g>
      </svg>
      <CanvasHint machine={m} />
    </div>
  );
}

/** Estados ativos (com contagem de configurações) e arestas usadas no ponto atual da simulação. */
function highlights(m: Machine, sim: SimState): { activeCount: Map<string, number>; usedEdges: Set<string> } {
  const activeCount = new Map<string, number>();
  const usedEdges = new Set<string>();
  if (sim.stale) return { activeCount, usedEdges };
  if (sim.trace && !isPDA(m)) {
    const step = sim.trace.steps[sim.cursor];
    for (const s of step?.active ?? []) activeCount.set(s, 1);
    for (const e of [...(step?.symbolEdges ?? []), ...(step?.epsilonEdges ?? [])]) usedEdges.add(e);
  } else if (sim.pdaTrace) {
    const t = sim.pdaTrace;
    const ids = sim.pdaView === 'path' && t.acceptingPath ? [t.acceptingPath[sim.cursor]] : (t.levels[sim.cursor]?.configs ?? []);
    for (const id of ids) {
      const c = t.configs[id];
      if (!c) continue;
      activeCount.set(c.state, (activeCount.get(c.state) ?? 0) + 1);
      if (c.via) usedEdges.add(c.via.edgeId);
    }
  }
  return { activeCount, usedEdges };
}

function CanvasHint({ machine }: { machine: Machine }) {
  const tool = useApp((s) => s.tool);
  const pending = useApp((s) => s.pendingEdgeFrom);
  let text = '';
  if (machine.states.length === 0) text = 'Canvas vazio. Pressione S (ferramenta Estado) e clique para criar estados, ou abra um exemplo à esquerda.';
  else if (tool === 'edge') text = pending ? 'Agora clique no estado de destino (o mesmo estado cria um laço). Esc cancela.' : 'Arraste de um estado a outro, ou clique na origem e depois no destino.';
  else if (tool === 'state') text = 'Clique em um espaço vazio para criar um estado.';
  if (!text) return null;
  return (
    <div className="canvas-hint" role="status">
      {text}
    </div>
  );
}
