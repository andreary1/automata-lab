import { create } from 'zustand';
import type { BatchCase, BatchResult } from '../core/fa/batch';
import type { FiniteAutomaton } from '../core/fa/model';
import { simulateFA, type FATrace } from '../core/fa/simulate';
import { EXAMPLES } from '../core/examples';
import { newProject, type Project } from '../core/persistence/schema';
import { ProjectStore, type KV } from '../core/persistence/storage';
import { MemoryKV } from '../core/persistence/storage';

export type Tool = 'select' | 'state' | 'edge';
export type Theme = 'light' | 'dark';
export type RightTab = 'props' | 'table' | 'formal';
export type BottomTab = 'sim' | 'batch';

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface SimState {
  input: string;
  trace: FATrace | null;
  /** Índice do passo exibido em trace.steps. */
  cursor: number;
  playing: boolean;
  /** Passos por segundo. */
  speed: number;
  interrupted: boolean;
  /** A máquina mudou depois de a simulação começar. */
  stale: boolean;
}

export interface BatchState {
  running: boolean;
  progress: [number, number];
  results: BatchResult[] | null;
  /** Resultados correspondem a uma versão anterior da máquina. */
  stale: boolean;
}

const HISTORY_LIMIT = 200;

function safeStorage(): KV {
  try {
    const k = '__automata_lab_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return new MemoryKV();
  }
}

export const projectStore = new ProjectStore(typeof window !== 'undefined' ? safeStorage() : new MemoryKV());

function initialProject(): Project {
  const last = projectStore.lastOpened();
  if (last) {
    const p = projectStore.load(last);
    if (p) return p;
  }
  const first = projectStore.list()[0];
  if (first) {
    const p = projectStore.load(first.id);
    if (p) return p;
  }
  const ex = EXAMPLES[0];
  return newProject('Meu primeiro autômato', structuredClone(ex.machine), {
    description: `Baseado no exemplo "${ex.title}": ${ex.language}`,
    tests: structuredClone(ex.tests),
  });
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('automata-lab:theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* sem armazenamento */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface AppState {
  project: Project;
  past: FiniteAutomaton[];
  future: FiniteAutomaton[];
  /** Snapshot antes de uma edição contínua (arrastar). */
  transientBase: FiniteAutomaton | null;
  selection: { states: string[]; edges: string[] };
  tool: Tool;
  pendingEdgeFrom: string | null;
  view: View;
  theme: Theme;
  rightTab: RightTab;
  bottomTab: BottomTab;
  panels: { left: boolean; right: boolean; bottom: boolean };
  saveStatus: { kind: 'saved' | 'pending' | 'error'; at?: string; message?: string };
  sim: SimState;
  batch: BatchState;
  toast: { text: string; kind: 'info' | 'error' } | null;
  dialog: null | 'projects' | 'help' | 'import' | 'examples';
  /** Pedido para focar o campo de nome (incrementa a cada pedido). */
  focusNameTick: number;
  fitTick: number;

  apply(fn: (m: FiniteAutomaton) => FiniteAutomaton): void;
  beginTransient(): void;
  applyTransient(fn: (m: FiniteAutomaton) => FiniteAutomaton): void;
  endTransient(): void;
  undo(): void;
  redo(): void;
  setProjectMeta(patch: Partial<Pick<Project, 'name' | 'description'>>): void;
  setTests(tests: BatchCase[]): void;
  setMaxSteps(n: number): void;
  openProject(p: Project): void;
  select(sel: { states?: string[]; edges?: string[] }, additive?: boolean): void;
  clearSelection(): void;
  setTool(t: Tool): void;
  setPendingEdgeFrom(id: string | null): void;
  setView(v: View): void;
  setTheme(t: Theme): void;
  setRightTab(t: RightTab): void;
  setBottomTab(t: BottomTab): void;
  togglePanel(p: 'left' | 'right' | 'bottom', open?: boolean): void;
  setSaveStatus(s: AppState['saveStatus']): void;
  showToast(text: string, kind?: 'info' | 'error'): void;
  setDialog(d: AppState['dialog']): void;
  requestFocusName(): void;
  requestFit(): void;

  // Simulação
  setSimInput(s: string): void;
  simStart(): FATrace;
  simStep(delta: 1 | -1): void;
  simJump(i: number): void;
  simPlay(): void;
  simPause(): void;
  simStop(): void;
  simReset(): void;
  setSpeed(n: number): void;

  setBatch(patch: Partial<BatchState>): void;
}

const invalidateRuns = (s: AppState) => ({
  sim: s.sim.trace ? { ...s.sim, playing: false, stale: true } : s.sim,
  batch: s.batch.results ? { ...s.batch, stale: true } : s.batch,
});

export const useApp = create<AppState>()((set, get) => ({
  project: initialProject(),
  past: [],
  future: [],
  transientBase: null,
  selection: { states: [], edges: [] },
  tool: 'select',
  pendingEdgeFrom: null,
  view: { x: 0, y: 0, k: 1 },
  theme: readTheme(),
  rightTab: 'props',
  bottomTab: 'sim',
  panels: { left: true, right: true, bottom: true },
  saveStatus: { kind: 'saved' },
  sim: { input: '', trace: null, cursor: 0, playing: false, speed: 2, interrupted: false, stale: false },
  batch: { running: false, progress: [0, 0], results: null, stale: false },
  toast: null,
  dialog: null,
  focusNameTick: 0,
  fitTick: 0,

  apply(fn) {
    const s = get();
    const next = fn(s.project.machine);
    if (next === s.project.machine) return;
    set({
      project: { ...s.project, machine: next, updatedAt: new Date().toISOString() },
      past: [...s.past, s.project.machine].slice(-HISTORY_LIMIT),
      future: [],
      ...invalidateRuns(s),
    });
  },
  beginTransient() {
    set({ transientBase: get().project.machine });
  },
  applyTransient(fn) {
    const s = get();
    set({ project: { ...s.project, machine: fn(s.project.machine) } });
  },
  endTransient() {
    const s = get();
    const base = s.transientBase;
    if (!base) return;
    if (base === s.project.machine || JSON.stringify(base) === JSON.stringify(s.project.machine)) {
      set({ transientBase: null });
      return;
    }
    set({
      transientBase: null,
      project: { ...s.project, updatedAt: new Date().toISOString() },
      past: [...s.past, base].slice(-HISTORY_LIMIT),
      future: [],
    });
  },
  undo() {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      project: { ...s.project, machine: prev, updatedAt: new Date().toISOString() },
      past: s.past.slice(0, -1),
      future: [s.project.machine, ...s.future],
      selection: pruneSelection(s.selection, prev),
      ...invalidateRuns(s),
    });
  },
  redo() {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    set({
      project: { ...s.project, machine: next, updatedAt: new Date().toISOString() },
      past: [...s.past, s.project.machine],
      future: s.future.slice(1),
      selection: pruneSelection(s.selection, next),
      ...invalidateRuns(s),
    });
  },
  setProjectMeta(patch) {
    const s = get();
    set({ project: { ...s.project, ...patch, updatedAt: new Date().toISOString() } });
  },
  setTests(tests) {
    const s = get();
    set({ project: { ...s.project, tests, updatedAt: new Date().toISOString() }, batch: s.batch.results ? { ...s.batch, stale: true } : s.batch });
  },
  setMaxSteps(n) {
    const s = get();
    set({ project: { ...s.project, settings: { ...s.project.settings, maxSteps: n }, updatedAt: new Date().toISOString() } });
  },
  openProject(p) {
    set({
      project: p,
      past: [],
      future: [],
      selection: { states: [], edges: [] },
      pendingEdgeFrom: null,
      sim: { ...get().sim, input: '', trace: null, cursor: 0, playing: false, interrupted: false, stale: false },
      batch: { running: false, progress: [0, 0], results: null, stale: false },
      fitTick: get().fitTick + 1,
    });
    projectStore.save(p);
  },
  select(sel, additive) {
    const s = get();
    if (additive) {
      const toggle = (arr: string[], ids: string[] = []) => {
        const out = new Set(arr);
        for (const id of ids) out.has(id) ? out.delete(id) : out.add(id);
        return [...out];
      };
      set({ selection: { states: toggle(s.selection.states, sel.states), edges: toggle(s.selection.edges, sel.edges) } });
    } else set({ selection: { states: sel.states ?? [], edges: sel.edges ?? [] }, rightTab: 'props' });
  },
  clearSelection() {
    set({ selection: { states: [], edges: [] } });
  },
  setTool(t) {
    set({ tool: t, pendingEdgeFrom: null });
  },
  setPendingEdgeFrom(id) {
    set({ pendingEdgeFrom: id });
  },
  setView(v) {
    set({ view: v });
  },
  setTheme(t) {
    try {
      localStorage.setItem('automata-lab:theme', t);
    } catch {
      /* ok */
    }
    set({ theme: t });
  },
  setRightTab(t) {
    set({ rightTab: t, panels: { ...get().panels, right: true } });
  },
  setBottomTab(t) {
    set({ bottomTab: t, panels: { ...get().panels, bottom: true } });
  },
  togglePanel(p, open) {
    const panels = { ...get().panels };
    panels[p] = open ?? !panels[p];
    // Em telas estreitas os painéis laterais são sobrepostos: só um por vez.
    if (panels[p] && p !== 'bottom' && typeof window !== 'undefined' && window.innerWidth <= 900) {
      if (p === 'left') panels.right = false;
      else panels.left = false;
    }
    set({ panels });
  },
  setSaveStatus(s) {
    set({ saveStatus: s });
  },
  showToast(text, kind = 'info') {
    set({ toast: { text, kind } });
  },
  setDialog(d) {
    set({ dialog: d });
  },
  requestFocusName() {
    set({ focusNameTick: get().focusNameTick + 1, rightTab: 'props', panels: { ...get().panels, right: true } });
  },
  requestFit() {
    set({ fitTick: get().fitTick + 1 });
  },

  setSimInput(input) {
    set({ sim: { ...get().sim, input } });
  },
  simStart() {
    const s = get();
    const trace = simulateFA(s.project.machine, s.sim.input, { maxSteps: s.project.settings.maxSteps });
    set({ sim: { ...s.sim, trace, cursor: 0, playing: false, interrupted: false, stale: false } });
    return trace;
  },
  simStep(d) {
    const s = get();
    let trace = s.sim.trace;
    if (!trace || s.sim.stale) {
      trace = get().simStart();
      return;
    }
    const cursor = Math.max(0, Math.min(trace.steps.length - 1, s.sim.cursor + d));
    set({ sim: { ...get().sim, cursor, playing: false } });
  },
  simJump(i) {
    const s = get();
    if (!s.sim.trace) return;
    set({ sim: { ...s.sim, cursor: Math.max(0, Math.min(s.sim.trace.steps.length - 1, i)), playing: false } });
  },
  simPlay() {
    const s = get();
    let trace = s.sim.trace;
    if (!trace || s.sim.stale || s.sim.interrupted) trace = get().simStart();
    if (trace.steps.length === 0) return;
    const cur = get().sim;
    const atEnd = cur.cursor >= trace.steps.length - 1;
    set({ sim: { ...cur, playing: true, cursor: atEnd ? 0 : cur.cursor } });
  },
  simPause() {
    set({ sim: { ...get().sim, playing: false } });
  },
  simStop() {
    const s = get();
    if (!s.sim.trace) return;
    set({ sim: { ...s.sim, playing: false, interrupted: true } });
  },
  simReset() {
    set({ sim: { ...get().sim, trace: null, cursor: 0, playing: false, interrupted: false, stale: false } });
  },
  setSpeed(n) {
    set({ sim: { ...get().sim, speed: n } });
  },
  setBatch(patch) {
    set({ batch: { ...get().batch, ...patch } });
  },
}));

function pruneSelection(sel: { states: string[]; edges: string[] }, m: FiniteAutomaton) {
  const s = new Set(m.states.map((x) => x.id));
  const e = new Set(m.edges.map((x) => x.id));
  return { states: sel.states.filter((id) => s.has(id)), edges: sel.edges.filter((id) => e.has(id)) };
}

/** Salvamento automático com atraso, a cada mudança do projeto. */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useApp.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  if (s.transientBase) return; // espera terminar o arraste
  if (s.saveStatus.kind !== 'pending') useApp.getState().setSaveStatus({ kind: 'pending' });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const p = useApp.getState().project;
    const r = projectStore.save(p);
    useApp.getState().setSaveStatus(r.ok ? { kind: 'saved', at: new Date().toISOString() } : { kind: 'error', message: r.error });
  }, 500);
});
