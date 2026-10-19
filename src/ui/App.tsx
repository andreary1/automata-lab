import { useEffect, useRef, useState } from 'react';
import { deleteEdges, deleteStates, moveStates } from '../core/fa/edit';
import { parseProjectFile, type Project } from '../core/persistence/schema';
import { useApp } from '../state/store';
import { BottomPanel } from './BottomPanel';
import { Canvas } from './Canvas';
import { ConfirmDialog, HelpDialog, ImportDialog, ProjectsDialog } from './Dialogs';
import { Icon } from './icons';
import { LeftPanel } from './LeftPanel';
import { RegularDialog } from './RegularDialog';
import { RightPanel } from './RightPanel';
import { TopBar } from './TopBar';

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT') return !['checkbox', 'radio', 'button', 'range', 'file'].includes((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export function App() {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = useApp((s) => s.theme);
  const panels = useApp((s) => s.panels);
  const dialog = useApp((s) => s.dialog);
  const toast = useApp((s) => s.toast);
  const [importing, setImporting] = useState<{ projects: Project[]; warnings: string[] } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useApp.setState({ toast: null }), toast.kind === 'error' ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Painéis laterais começam (e ficam) recolhidos ao entrar em telas estreitas
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const collapse = () => {
      useApp.getState().togglePanel('left', false);
      useApp.getState().togglePanel('right', false);
    };
    if (window.innerWidth <= 900) collapse();
    let was = window.innerWidth <= 900;
    const onResize = () => {
      const now = window.innerWidth <= 900;
      if (now && !was) collapse();
      was = now;
      setNarrow(now);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const st = useApp.getState();
      if (st.dialog || st.confirmReq) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? st.redo() : st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod || e.altKey) return;
      const { states, edges } = st.selection;
      switch (e.key) {
        case 'v':
        case 'V':
          st.setTool('select');
          break;
        case 's':
        case 'S':
          st.setTool('state');
          break;
        case 't':
        case 'T':
          st.setTool('edge');
          break;
        case 'f':
        case 'F':
          st.requestFit();
          break;
        case '?':
          st.setDialog('help');
          break;
        case 'Escape':
          if (st.pendingEdgeFrom) st.setPendingEdgeFrom(null);
          else st.clearSelection();
          break;
        case 'Delete':
        case 'Backspace':
          if (states.length || edges.length) {
            e.preventDefault();
            st.apply((m) => deleteEdges(deleteStates(m, new Set(states)), new Set(edges)));
            st.clearSelection();
          }
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!states.length) return;
          e.preventDefault();
          const d = e.shiftKey ? 50 : 10;
          const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]!;
          st.apply((m) => moveStates(m, new Map(m.states.filter((s) => states.includes(s.id)).map((s) => [s.id, { x: s.x + dx, y: s.y + dy }]))));
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const r = parseProjectFile(text);
    if (!r.ok) useApp.getState().showToast(`Importação recusada: ${r.errors.join(' ')}`, 'error');
    else setImporting({ projects: r.projects, warnings: r.warnings });
    if (fileRef.current) fileRef.current.value = '';
  };

  const cls = ['app', !panels.left && 'no-left', !panels.right && 'no-right', !panels.bottom && 'no-bottom'].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <TopBar svgRef={svgRef} onImport={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {panels.left && <LeftPanel />}
      <main className="center">
        <Canvas svgRef={svgRef} />
        <div className="panel-toggles">
          <button className="btn small ghost" onClick={() => useApp.getState().togglePanel('left')} aria-pressed={panels.left} aria-label={panels.left ? 'Recolher painel esquerdo' : 'Mostrar painel esquerdo'} title="Painel esquerdo">
            <Icon name="panelL" />
          </button>
          <button className="btn small ghost" onClick={() => useApp.getState().togglePanel('bottom')} aria-pressed={panels.bottom} aria-label={panels.bottom ? 'Recolher painel inferior' : 'Mostrar painel inferior'} title="Painel inferior">
            <Icon name="panelB" />
          </button>
          <button className="btn small ghost" onClick={() => useApp.getState().togglePanel('right')} aria-pressed={panels.right} aria-label={panels.right ? 'Recolher painel direito' : 'Mostrar painel direito'} title="Painel direito">
            <Icon name="panelR" />
          </button>
        </div>
      </main>
      {narrow && (panels.left || panels.right) && (
        <button
          className="overlay-backdrop"
          aria-label="Fechar painel"
          onClick={() => {
            useApp.getState().togglePanel('left', false);
            useApp.getState().togglePanel('right', false);
          }}
        />
      )}
      {panels.right && <RightPanel />}
      {panels.bottom && <BottomPanel />}
      {dialog === 'projects' && <ProjectsDialog />}
      {dialog === 'help' && <HelpDialog />}
      {dialog === 'regular' && <RegularDialog />}
      {importing && <ImportDialog pending={importing.projects} warnings={importing.warnings} onClose={() => setImporting(null)} />}
      <ConfirmDialog />
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {toast.text}
          <button className="btn ghost icon-only" onClick={() => useApp.setState({ toast: null })} aria-label="Fechar aviso">
            <Icon name="x" />
          </button>
        </div>
      )}
    </div>
  );
}
